import { ollamaJson } from './queue-ollama.mjs';
import { reviewScaffold } from '../publishing/validate-content.mjs';
import { contentDigest, evaluateContent, todayInSeoul } from '../publishing/content-standards.mjs';
import { TOPIC_ENTITIES, normTopic, DOMAINS, REVIEW_CHECKS } from '../publishing/standards/common.mjs';

const ALLOWED_RELATIONSHIPS=['supportive-food','nutrient-source','symptom-care','interaction','treatment-context','alternative','risk-context','none'];
const COMBINATION_RELATIONSHIPS=['benefit','compatible-only','symptom-support','avoid','consult','insufficient-evidence'];

function detailsSchema(item,article,evidence){
  const sectionIds=article.sections.map(s=>s.id),sourceIds=evidence.sources.map(s=>s.id),others=DOMAINS.filter(d=>d!==item.domain);
  return {type:'object',additionalProperties:false,required:['meaning','classificationReason','primaryQuestion','readerSituation','nextActions','connections','comparisons','combinations','selectionCriteria'],properties:{
    meaning:{type:'string',minLength:4,maxLength:160},
    classificationReason:{type:'string',minLength:12,maxLength:240},
    primaryQuestion:{type:'string',minLength:12,maxLength:240},
    readerSituation:{type:'string',minLength:12,maxLength:240},
    nextActions:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:10,maxLength:160}},
    connections:{type:'array',minItems:others.length,maxItems:others.length,items:{type:'object',additionalProperties:false,required:['domain','status','reason','relationship','sectionId','sourceIds'],properties:{
      domain:{type:'string',enum:others},status:{type:'string',enum:['included','not-applicable']},reason:{type:'string',minLength:12,maxLength:260},
      relationship:{type:'string',enum:ALLOWED_RELATIONSHIPS},sectionId:{type:'string',enum:['',...sectionIds]},sourceIds:{type:'array',items:{type:'string',enum:sourceIds}}
    }}},
    comparisons:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['left','right','goal','basis','directness','limitations','sectionId','sourceIds'],properties:{
      left:{type:'string',minLength:1},right:{type:'string',minLength:1},goal:{type:'string',minLength:8},basis:{type:'string',minLength:8},
      directness:{type:'string',enum:['head-to-head','indirect','qualitative']},limitations:{type:'string',minLength:8},sectionId:{type:'string',enum:sectionIds},
      sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}}
    }}},
    combinations:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['items','relationship','purpose','sectionId','sourceIds'],properties:{
      items:{type:'array',minItems:2,items:{type:'string',minLength:1}},relationship:{type:'string',enum:COMBINATION_RELATIONSHIPS},
      purpose:{type:'string',minLength:8},sectionId:{type:'string',enum:sectionIds},sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}}
    }}},
    selectionCriteria:{type:'array',maxItems:5,items:{type:'object',additionalProperties:false,required:['criterion','whyItMatters','howToCheck','sectionId','sourceIds'],properties:{
      criterion:{type:'string',minLength:8},whyItMatters:{type:'string',minLength:8},howToCheck:{type:'string',minLength:8},
      sectionId:{type:'string',enum:sectionIds},sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}}
    }}}
  }};
}
export async function reviewDetails(item,article,evidence,extensions,{model,fetcher=fetch}={}){
  return ollamaJson([
    {role:'system',content:'작성된 글과 실제 근거를 다시 읽는 편집 검토자다. 검색의도·다른 분야 연결·비교·병용·제품 선택을 실제 본문에 존재하는 섹션에만 연결한다. sectionId와 sourceIds는 제공 목록만 사용한다. extension이 false인 항목을 억지로 만들지 않는다. included 연결은 실제 관련성이 있을 때만 사용하고 아니면 not-applicable로 구체적 이유를 적는다.'},
    {role:'user',content:JSON.stringify({item,extensions,sections:article.sections,sources:evidence.sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,notes:s.notes.slice(0,2200)}))})}
  ],detailsSchema(item,article,evidence),{model,fetcher,numPredict:7000});
}
function anchored(sectionMap,obj){
  const section=sectionMap.get(obj.sectionId);if(!section)throw new Error('E_QUEUE_REVIEW_SECTION');
  if(!Array.isArray(obj.sourceIds)||obj.sourceIds.some(id=>!section.sourceIds.includes(id)))throw new Error('E_QUEUE_REVIEW_SOURCE_SCOPE');
  return {heading:section.heading,answerQuote:section.keyPoint,sourceIds:obj.sourceIds};
}
export function buildReview(source,item,evidence,extensions,article,required,details,glossary){
  const review=reviewScaffold(source);review.domain=item.domain;
  const entityId=TOPIC_ENTITIES[normTopic(item.keyword)]||`${item.domain}:article-${item.articleId}`;
  review.classification={rawInput:item.keyword,topic:item.keyword,meaning:item.keyword==='배'?'과일 배':details.meaning,entityId,status:'resolved',reason:details.classificationReason};
  review.sourceDigest=contentDigest(source);
  review.intent={primaryQuestion:details.primaryQuestion,readerSituation:details.readerSituation,nextActions:details.nextActions};
  review.extensions=extensions;
  const sectionMap=new Map(article.sections.map(s=>[s.id,s]));
  review.coverage=required.map(module=>{
    const section=article.sections.find(s=>s.modules.includes(module));if(!section)throw new Error('E_QUEUE_REVIEW_COVERAGE');
    return {module,heading:section.heading,answerQuote:section.keyPoint,sourceIds:section.sourceIds};
  });
  review.connections={};
  for(const c of details.connections){
    if(c.status==='not-applicable'){review.connections[c.domain]={status:'not-applicable',reason:c.reason};continue;}
    const a=anchored(sectionMap,c);review.connections[c.domain]={status:'included',reason:c.reason,relationship:c.relationship,...a};
  }
  for(const domain of DOMAINS.filter(d=>d!==item.domain))if(!review.connections[domain])review.connections[domain]={status:'not-applicable',reason:`${item.keyword}의 이번 자동 조사 근거에서는 ${domain} 분야를 필수 연결로 확인하지 못해 강제로 포함하지 않는다.`};
  review.sources=evidence.sources.map(({id,url,title,kind,role,checkedAt,scopeNote})=>({id,url,title,kind,role,checkedAt,scopeNote}));
  review.glossary=glossary;
  review.comparisons=details.comparisons.map(x=>({...x,...anchored(sectionMap,x)}));review.comparisons.forEach(x=>delete x.sectionId);
  review.combinations=details.combinations.map(x=>({...x,...anchored(sectionMap,x)}));review.combinations.forEach(x=>delete x.sectionId);
  review.selectionCriteria=details.selectionCriteria.map(x=>({...x,...anchored(sectionMap,x)}));review.selectionCriteria.forEach(x=>delete x.sectionId);
  return review;
}
function auditSchema(){
  const properties={};
  for(const key of REVIEW_CHECKS)properties[key]={type:'object',additionalProperties:false,required:['status','note'],properties:{status:{type:'string',enum:['pass','fail']},note:{type:'string',minLength:12,maxLength:320}}};
  return {type:'object',additionalProperties:false,required:REVIEW_CHECKS,properties};
}
export async function auditReview(item,source,review,evidence,{model,fetcher=fetch}={}){
  return ollamaJson([
    {role:'system',content:'최종 편집 검토다. 실제 source·review·근거를 읽고 11개 항목을 각각 pass/fail로 판단한다. 형식 통과를 위해 무조건 pass하지 않는다. 다른 주제로 바뀐 설명, 확인되지 않은 수치·효능·권장량, 출처와 다른 주장, 필요한 의료 안전정보 누락은 fail이다. 출처 이름에 주제 단어가 있어도 그 연구의 대상·형태·결과가 주장과 일치하는지 확인한다. 근거 부족인 선택 항목을 제외했거나 확인 자료의 한계를 정확하게 설명한 것은 실패 사유가 아니다. 모든 글에 임상시험·비교·조합·제품 추천을 강제하지 않는다. 같은 요약의 적절한 재등장은 허용하고 의미 없는 반복은 구분한다. 이미지 검토 기록만으로 실제 이미지를 보았다고 주장하지 않는다. 판단은 코드의 의미 증명이 아니라 AI 편집 검토임을 유지한다.'},
    {role:'user',content:JSON.stringify({item,source,review,sources:evidence.sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,notes:s.notes.slice(0,2200)}))})}
  ],auditSchema(),{model,fetcher,numPredict:4500});
}
async function warningResolutions(warnings,{model,fetcher=fetch}={}){
  if(!warnings.length)return [];
  const schema={type:'object',additionalProperties:false,required:['items'],properties:{items:{type:'array',minItems:warnings.length,maxItems:warnings.length,items:{type:'object',additionalProperties:false,required:['code','note'],properties:{code:{type:'string',enum:warnings.map(w=>w.code)},note:{type:'string',minLength:12,maxLength:260}}}}}};
  const out=await ollamaJson([
    {role:'system',content:'편집 경고를 실제로 검토하고, 왜 공개를 막지 않아도 되는지 또는 어떤 조건을 확인했는지 구체적으로 기록한다. 형식적 문구를 쓰지 않는다.'},
    {role:'user',content:JSON.stringify(warnings)}
  ],schema,{model,fetcher,numPredict:1800});
  return out.items;
}
export async function finalizeReview(source,item,evidence,extensions,article,required,details,glossary,{model,fetcher=fetch}={}){
  const review=buildReview(source,item,evidence,extensions,article,required,details,glossary);
  const audit=await auditReview(item,source,review,evidence,{model,fetcher});
  const failed=Object.entries(audit).filter(([,value])=>value.status!=='pass');
  if(failed.length)throw Object.assign(new Error('E_QUEUE_REVIEW_FAILED'),{failed});
  review.review={status:'approved',checkedAt:todayInSeoul(),reviewer:{name:`Ollama ${model} 근거 제한 작성·재검토`,kind:'ai',independence:'same-author'},checks:audit,warningResolutions:[]};
  review.sourceDigest=contentDigest(source);
  let report=evaluateContent(source,review,{today:todayInSeoul(),enforceScanDensity:true});
  if(report.warnings.length){
    review.review.warningResolutions=await warningResolutions(report.warnings,{model,fetcher});
    report=evaluateContent(source,review,{today:todayInSeoul(),enforceScanDensity:true});
  }
  if(!report.passed)throw Object.assign(new Error(report.errors[0]?.code||'E_QUEUE_CONTENT_REVIEW'),{details:report.errors,warnings:report.warnings});
  return {review,report};
}
