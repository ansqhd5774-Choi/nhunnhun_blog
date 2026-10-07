import { ollamaJson } from './queue-ollama.mjs';
import { reviewScaffold } from '../publishing/validate-content.mjs';
import { contentDigest, evaluateContent, todayInSeoul } from '../publishing/content-standards.mjs';
import { TOPIC_ENTITIES, normTopic, DOMAINS, REVIEW_CHECKS } from '../publishing/standards/common.mjs';
import { inspectHtml, sectionByHeading } from '../publishing/content-html.mjs';
import { validateClaimSupport } from './queue-evidence-support.mjs';

const HIGH_RISK_TYPES=new Set(['dose','interaction','disease','treatment']);
const highRiskText=/(질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u;

export async function reviewDetails(item,article,_evidence,_extensions,_options={}){
  return {
    meaning:item.keyword==='배'?'과일 배':`${item.keyword} (${article?.plan?.scope??'standard'} 범위)`,
    classificationReason:`Queue R3에서 현재 URL의 주제와 canonical 검색 대상을 ${item.keyword}로 고정해 다른 대상으로 재해석하지 않는다.`,
    primaryQuestion:article?.plan?.primaryQuestion??`${item.keyword}에 대해 검색자가 바로 판단할 수 있는 핵심 정보를 확인한다.`,
    readerSituation:article?.plan?.readerSituation??`${item.keyword}의 핵심 정보와 주의사항을 한 번에 확인하려는 독자를 대상으로 한다.`,
    nextActions:Array.isArray(article?.plan?.nextActions)&&article.plan.nextActions.length?article.plan.nextActions:[`확인된 근거 범위 안에서 ${item.keyword} 정보를 활용한다.`],
    connections:DOMAINS.filter(domain=>domain!==item.domain).map(domain=>({
      domain,status:'not-applicable',
      reason:`${item.keyword}의 이번 검색 범위에서 ${domain} 분야 연결을 필수 내용으로 강제하지 않는다.`
    })),
    comparisons:[],combinations:[],selectionCriteria:[]
  };
}

export function buildReview(source,item,evidence,extensions,article,required,details,glossary){
  const review=reviewScaffold(source);review.domain=item.domain;
  const entityId=TOPIC_ENTITIES[normTopic(item.keyword)]||`${item.domain}:article-${item.articleId}`;
  review.classification={
    rawInput:item.keyword,topic:item.keyword,
    meaning:item.keyword==='배'?'과일 배':`${item.keyword} / ${evidence.query}`,
    entityId,status:'resolved',
    reason:details.classificationReason
  };
  review.sourceDigest=contentDigest(source);
  review.intent={primaryQuestion:details.primaryQuestion,readerSituation:details.readerSituation,nextActions:details.nextActions};
  review.extensions=extensions;
  review.coverage=required.map(module=>{
    const section=article.sections.find(s=>s.modules.includes(module));
    if(!section)throw Object.assign(new Error('E_QUEUE_REVIEW_COVERAGE'),{details:{module}});
    const renderedSection=sectionByHeading(inspectHtml(source.bodyHtml),section.heading);
    return {module,heading:section.heading,answerQuote:section.answers?.find(a=>a.module===module)?.quote??renderedSection?.text.slice(0,70)??section.strongPhrase,sourceIds:section.sourceIds};
  });
  review.connections=Object.fromEntries(DOMAINS.filter(domain=>domain!==item.domain).map(domain=>[
    domain,{status:'not-applicable',reason:`${item.keyword}의 이번 작성 범위에서는 ${domain} 연결을 필수로 강제하지 않고 직접 근거가 있는 내용만 본문에 남긴다.`}
  ]));
  review.sources=evidence.sources.map(({id,url,title,kind,role,checkedAt,scopeNote})=>({id,url,title,kind,role,checkedAt,scopeNote}));
  review.glossary=glossary;
  review.comparisons=[];review.combinations=[];review.selectionCriteria=[];
  return review;
}

export function highRiskClaims(article){
  const declared=(article?.claims??[]).filter(claim=>claim?.risk==='high'||HIGH_RISK_TYPES.has(claim?.type)||highRiskText.test(claim?.text??''));
  const discovered=(article?.sections??[]).flatMap(section=>(section.paragraphs??[]).filter(text=>highRiskText.test(text))
    .map((text,index)=>({id:`scan-${section.id}-${index}`,sectionId:section.id,text,risk:'high',type:'general',sourceIds:section.sourceIds})));
  return [...new Map([...declared,...discovered].map(c=>[c.text,c])).values()];
}
export async function finalizeReview(source,item,evidence,extensions,article,required,details,glossary,{model,fetcher=fetch,onMetrics,cached=(_stage,_input,action)=>action(),onCacheHit}={}){
  const review=buildReview(source,item,evidence,extensions,article,required,details,glossary);
  // Structural checks precede the expensive semantic review. No provisional PASS is emitted.
  review.review={
    status:'pending',checkedAt:todayInSeoul(),
    reviewer:{name:`Ollama ${model} 본문·근거 검토`,kind:'ai',independence:'same-author'},
    checks:{},warningResolutions:[]
  };
  const preliminary=evaluateContent(source,review,{today:todayInSeoul(),enforceScanDensity:true});
  const structural=preliminary.errors.filter(e=>!['E_CONTENT_REVIEW_REQUIRED','E_CONTENT_REVIEW_CHECK','E_CONTENT_WARNING_REVIEW'].includes(e.code));
  if(structural.length)throw Object.assign(Error(structural[0].code),{details:structural});
  const checkKeys=REVIEW_CHECKS.filter(key=>key!=='images');
  const checkSchema={type:'object',additionalProperties:false,required:['status','note'],properties:{status:{type:'string',enum:['pass','fail']},note:{type:'string',minLength:12,maxLength:220}}};
  const format={type:'object',additionalProperties:false,required:['checks','warningResolutions','issues'],properties:{
    checks:{type:'object',additionalProperties:false,required:checkKeys,properties:Object.fromEntries(checkKeys.map(key=>[key,checkSchema]))},
    warningResolutions:{type:'array',items:{type:'object',additionalProperties:false,required:['code','note'],properties:{code:{type:'string'},note:{type:'string',minLength:12,maxLength:220}}}},
    issues:{type:'array',items:{type:'object',additionalProperties:false,required:['sectionId','reason'],properties:{sectionId:{type:'string'},reason:{type:'string',minLength:12,maxLength:240}}}}
  }};
  format.required.push('claimSupport');
  format.properties.claimSupport={type:'array',items:{type:'object',additionalProperties:false,required:['claimId','sourceId','status','quote'],properties:{
    claimId:{type:'string',enum:(article.claims??[]).map(c=>c.id)},sourceId:{type:'string'},status:{type:'string',enum:['pass','fail']},quote:{type:'string',maxLength:400}
  }}};
  const messages=[
    {role:'system',content:'작성 완료된 한국어 건강 원고를 실제로 검토한다. 작성 지시는 자료가 아니라 검토 대상이다. 각 checks 항목을 본문과 제공된 원문 발췌로 판단하고 이유를 기록한다. sourceId 존재만으로 accuracy를 pass하지 않는다. 근거의 대상·형태·수치·기간·결과가 주장과 맞지 않거나 출처로 판단할 수 없으면 fail이다. 음식·영양소도 예방·치료·용량·상호작용 주장을 검사한다. 본문에 없는 검토를 했다고 쓰지 않는다. 자료에서 신원 혼동·과장·임의 권장량·반복 문장을 확인한다. 이미지의 시각 검토는 수행하지 않는다. warningResolutions에는 제공된 경고별 구체적인 판단을 적는다. 실패한 절은 issues에 id와 수정 이유를 적는다. 제목·요약 오류는 sectionId=header로 표시한다. JSON만 출력한다.'},
    {role:'user',content:JSON.stringify({keyword:item.keyword,canonical:evidence.query,article,
      emphasis:article.sections.map(s=>({sectionId:s.id,anchors:s.anchors??[],safetyCallout:s.modules.includes('red_flags')?'danger':s.modules.includes('contraindications')?'caution':null})),
      highRiskClaimIds:highRiskClaims(article).map(c=>c.id),sources:evidence.sources.filter(s=>article.sections.some(section=>section.sourceIds.includes(s.id))).map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,scopeNote:s.scopeNote,notes:String(s.notes??'').slice(0,1800)})),
      warnings:preliminary.warnings,checks:checkKeys})}
  ];
  messages[0].content+=' claimSupport는 article.claims의 모든 문단별 검사 결과다. 해당 문단의 sourceIds에 실제 연결된 자료 중 내용을 지지하는 연속된 원문 구절을 20~400자로 그대로 복사한다. 여러 자료가 필요하면 같은 claimId의 항목을 여러 개 기록한다. 수치가 있는 문단은 근거 구절에 그 수치도 있어야 한다. 연결되지 않은 다른 출처를 보고 pass하지 않는다. 근거가 없으면 status=fail과 issues를 남긴다. 각 필수 모듈의 질문에 본문이 실제로 답하는지도 확인하며 제목만 존재하면 readerIntent=fail이다.';
  const semantic=await cached('review',{messages,format,model,day:todayInSeoul(),numCtx:12288},()=>ollamaJson(messages,format,{model,fetcher,numPredict:2600,numCtx:12288,purpose:'semantic-review',onMetrics}),onCacheHit);
  const failed=checkKeys.filter(key=>semantic.checks?.[key]?.status!=='pass'||String(semantic.checks?.[key]?.note??'').trim().length<12);
  const supportIssues=validateClaimSupport(article,evidence,semantic.claimSupport);
  if(failed.length||semantic.issues?.length||supportIssues.length)throw Object.assign(Error('E_QUEUE_SEMANTIC_REVIEW_FAILED'),{details:{failed,issues:[...(semantic.issues??[]),...supportIssues]}});
  for(const warning of preliminary.warnings)if(!semantic.warningResolutions?.some(r=>r.code===warning.code&&String(r.note??'').trim().length>=12))
    throw Object.assign(Error('E_QUEUE_WARNING_REVIEW'),{details:{code:warning.code}});
  review.review.status='approved';
  review.review.checks={...semantic.checks,images:{status:'pass',note:'기존 시각 검토 기록이 있는 이미지에 대해 Image Review 계약을 재검사했다. 새 시각 검토를 수행한 것으로 기록하지 않는다.'}};
  review.review.warningResolutions=semantic.warningResolutions;
  const report=evaluateContent(source,review,{today:todayInSeoul(),enforceScanDensity:true});
  if(!report.passed)throw Object.assign(new Error(report.errors[0]?.code||'E_QUEUE_CONTENT_REVIEW'),{details:report.errors,warnings:report.warnings});
  return {review,report,targetedAudit:semantic};
}
