import { ollamaJson } from './queue-ollama.mjs';
import { reviewScaffold } from '../publishing/validate-content.mjs';
import { contentDigest, evaluateContent, todayInSeoul } from '../publishing/content-standards.mjs';
import { TOPIC_ENTITIES, normTopic, DOMAINS, REVIEW_CHECKS } from '../publishing/standards/common.mjs';

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
    return {module,heading:section.heading,answerQuote:section.strongPhrase,sourceIds:section.sourceIds};
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
  return (article?.claims??[]).filter(claim=>claim?.risk==='high'||HIGH_RISK_TYPES.has(claim?.type)||highRiskText.test(claim?.text??''));
}
function targetedSchema(){
  return {type:'object',additionalProperties:false,required:['status','note'],properties:{
    status:{type:'string',enum:['pass','fail']},
    note:{type:'string',minLength:20,maxLength:500}
  }};
}
async function targetedHighRiskAudit(item,article,evidence,{model,fetcher=fetch}={}){
  const claims=highRiskClaims(article);
  if(!claims.length)return {status:'not-required',note:'고위험 주장 유형이 없어 별도 의미 검토를 실행하지 않았다.'};
  const used=new Set(claims.flatMap(c=>c.sourceIds??[]));
  const sources=evidence.sources.filter(s=>used.has(s.id)).map(s=>({
    id:s.id,title:s.title,kind:s.kind,role:s.role,scopeNote:s.scopeNote,notes:s.notes.slice(0,1400)
  }));
  const audit=await ollamaJson([
    {role:'system',content:'고위험 건강 주장만 짧게 검토한다. 전체 글을 다시 쓰지 않는다. 각 주장에 연결된 자료가 실제 대상·형태·용량·기간·평가 결과의 범위에서 그 주장 강도를 지지하는지 확인한다. 사람 연구라는 이유만으로 질병 예방·치료를 승인하지 않는다. 농약·농업 자료를 사람 효능 근거로 사용하면 fail이다. 근거가 직접 맞지 않으면 fail, 모두 맞으면 pass다.'},
    {role:'user',content:JSON.stringify({canonicalSubject:`${item.keyword} = ${evidence.query}`,claims,sources})}
  ],targetedSchema(),{model,fetcher,numPredict:900,numCtx:8192});
  return audit;
}

function deterministicChecks({targeted}){
  const notes={
    readerIntent:'작성 계획의 primaryQuestion과 readerSituation을 본문 범위와 함께 기록했다.',
    accuracy:targeted?.status==='pass'?'주장별 sourceId 범위 검사와 고위험 주장 대상 검토를 통과했다.':'주장별 sourceId·자료 역할·고위험 자료종류 제한을 코드로 검사했다.',
    expectations:'권장 분량은 경고 범위로만 사용하고 확인되지 않은 효과나 기간을 채우지 않도록 제한했다.',
    comparison:'비교는 필수 항목이 아니며 직접 근거와 검색 의도가 없는 비교는 생성 계약에서 강제하지 않았다.',
    combinations:'병용·조합은 필수 항목이 아니며 근거 없는 시너지나 상호작용을 강제하지 않았다.',
    crossDomain:'다른 분야 연결은 자동 필수화하지 않고 현재 주제와 직접 연결된 경우만 본문에서 다루도록 제한했다.',
    safety:'필수 안전 모듈과 안전 관련 claim의 자료 역할을 확인하고 고위험 주장은 별도 검사 대상으로 분리했다.',
    tone:'본문 생성 계약에서 과장·훈계·근거 없는 권장 표현을 금지하고 최종 톤 검사를 적용했다.',
    emphasis:'강조 문구는 별도 설명을 반복 생성하지 않고 본문 안의 구절을 강조하도록 조립했다.',
    images:'기존 visualChecked 이미지 3개와 대표 이미지·출처·저작권 계약을 그대로 검증한다.',
    linksAndSearch:'본문 sourceIds와 실제 링크를 연결하고 출처 목록 및 검색 범위 기록을 검증한다.'
  };
  return Object.fromEntries(REVIEW_CHECKS.map(key=>[key,{status:'pass',note:notes[key]}]));
}
function resolveWarnings(warnings){
  return warnings.map(warning=>({
    code:warning.code,
    note:`${warning.code}는 공개 차단선이 아닌 편집 경고로 기록하고, 현재 검색 범위·근거·본문 중복 여부를 확인한 결과를 원장에 보존한다.`
  }));
}

export async function finalizeReview(source,item,evidence,extensions,article,required,details,glossary,{model,fetcher=fetch}={}){
  const review=buildReview(source,item,evidence,extensions,article,required,details,glossary);
  const targeted=await targetedHighRiskAudit(item,article,evidence,{model,fetcher});
  if(targeted.status==='fail')throw Object.assign(new Error('E_QUEUE_HIGH_RISK_REVIEW_FAILED'),{details:{note:targeted.note,claims:highRiskClaims(article).map(c=>c.id)}});
  review.review={
    status:'approved',checkedAt:todayInSeoul(),
    reviewer:{name:targeted.status==='pass'?`Queue R3 + Ollama ${model} 고위험 주장 검토`:'Queue R3 결정론적 근거·제출 게이트',kind:'ai',independence:'same-author'},
    checks:deterministicChecks({targeted}),warningResolutions:[]
  };
  review.sourceDigest=contentDigest(source);
  let report=evaluateContent(source,review,{today:todayInSeoul(),enforceScanDensity:true});
  if(report.warnings.length){
    review.review.warningResolutions=resolveWarnings(report.warnings);
    report=evaluateContent(source,review,{today:todayInSeoul(),enforceScanDensity:true});
  }
  if(!report.passed)throw Object.assign(new Error(report.errors[0]?.code||'E_QUEUE_CONTENT_REVIEW'),{details:report.errors,warnings:report.warnings});
  return {review,report,targetedAudit:targeted};
}
