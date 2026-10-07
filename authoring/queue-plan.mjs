import { ollamaJson } from './queue-ollama.mjs';
import { DOMAIN_RULES } from '../publishing/content-standards.mjs';
import { MODULES } from '../publishing/standards/common.mjs';

export const SCOPE_BANDS=Object.freeze({
  focused:[1200,2200],
  standard:[2200,3800],
  comprehensive:[3500,5200],
  deep:[4500,6500],
});
export const SCOPE_SECTION_LIMITS=Object.freeze({
  focused:[4,6],
  standard:[5,8],
  comprehensive:[6,10],
  deep:[8,12],
});
const CLAIM_TYPES=['general','nutrition','benefit','safety','dose','interaction','disease','treatment'];
const HIGH_RISK_TYPES=new Set(['dose','interaction','disease','treatment']);
const norm=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim();

export function inferWritingScope(item,currentTitle=''){
  const haystack=norm(`${item?.keyword??''} ${currentTitle}`);
  const terms=['효능','영양','칼로리','보관','고르는','선택','조리','먹는','섭취','주의','부작용','알레르기','혈당','다이어트','제철','손질','활용','복용','용량','상호작용','증상','원인','진단','치료','예방','비교','권장','결핍','검사','금기'];
  const count=terms.filter(term=>haystack.includes(term)).length;
  if(['medicine','disease'].includes(item?.domain)&&count>=7)return 'deep';
  if(count>=6)return 'comprehensive';
  if(count>=3)return 'standard';
  return currentTitle?'focused':'standard';
}
export const lengthBandForScope=scope=>SCOPE_BANDS[scope]??SCOPE_BANDS.standard;
export const sectionLimitsForScope=scope=>SCOPE_SECTION_LIMITS[scope]??SCOPE_SECTION_LIMITS.standard;

const CORE_SKELETONS=Object.freeze({
  food:[
    ['identity-nutrition',['identity','nutrition'],'정체와 영양','무엇이며 영양 정보는 어떻게 봐야 하나요?'],
    ['benefits-amount',['benefits','amount'],'기대할 점과 섭취량','어떤 점을 기대할 수 있고 어느 정도 먹는 것이 현실적인가요?'],
    ['preparation-storage',['preparation','storage'],'조리와 보관','어떻게 조리하고 보관해야 하나요?'],
    ['selection-safety',['selection','safety'],'고르는 법과 주의사항','어떻게 고르고 무엇을 주의해야 하나요?'],
    ['decision',['decision'],'핵심 판단','지금 무엇을 확인하고 선택하면 되나요?'],
  ],
  nutrient:[
    ['identity-role',['identity','role'],'정체와 역할','무엇이며 몸에서 어떤 역할을 하나요?'],
    ['benefits-expectations',['benefits','expectations'],'기대효과와 근거','어떤 도움을 기대할 수 있고 근거의 한계는 무엇인가요?'],
    ['audience-amount-use',['audience','amount','use'],'대상·섭취량·사용법','누가 고려하고 얼마나 어떻게 사용하나요?'],
    ['safety-interactions',['safety','interactions'],'안전성과 상호작용','주의할 점과 상호작용은 무엇인가요?'],
    ['selection-decision',['selection','decision'],'선택 기준과 판단','제품이나 식품을 어떻게 선택하고 다음 행동을 정하나요?'],
  ],
  medicine:[
    ['identity-indications',['identity','indications'],'정체와 허가된 용도','어떤 약이며 허가된 용도는 무엇인가요?'],
    ['audience-amount-use',['audience','amount','use'],'대상·용량·사용법','누가 어떤 용량과 방법으로 사용하나요?'],
    ['timeline',['timeline'],'효과와 관찰 시점','언제 효과를 기대하고 무엇을 관찰하나요?'],
    ['safety-contraindications-interactions',['safety','contraindications','interactions'],'주의·금기·상호작용','누가 피해야 하고 어떤 상호작용을 주의하나요?'],
    ['medical-help',['medical_help'],'진료가 필요한 경우','언제 의료진이나 약사에게 도움을 요청해야 하나요?'],
    ['storage-decision',['storage','decision'],'보관과 최종 판단','어떻게 보관하고 지금 무엇을 확인해야 하나요?'],
  ],
  disease:[
    ['identity-symptoms',['identity','symptoms'],'정체와 증상','어떤 상태이며 주요 증상은 무엇인가요?'],
    ['causes-risk',['causes','risk'],'원인과 위험요인','원인과 위험요인은 무엇인가요?'],
    ['self-check-diagnosis',['self_check','diagnosis'],'자가 점검과 진단','스스로 확인할 범위와 진단 과정은 어떻게 다른가요?'],
    ['treatment-home-care',['treatment','home_care'],'치료와 생활관리','표준치료와 집에서 할 수 있는 관리는 무엇인가요?'],
    ['red-flags-medical-help',['red_flags','medical_help'],'위험신호와 진료 시점','어떤 신호가 있으면 바로 진료해야 하나요?'],
    ['decision',['decision'],'핵심 판단','지금 어떤 행동을 선택해야 하나요?'],
  ],
});
export function buildCoreSkeleton(item){
  const rows=CORE_SKELETONS[item?.domain];
  if(!rows)throw new Error('E_QUEUE_PLAN_DOMAIN');
  return rows.map(([id,modules,heading,question])=>({id,modules:[...modules],heading,question}));
}

function agriculturalText(source){
  return `${source?.title??''} ${source?.notes??''}`.toLowerCase();
}
function looksAgricultural(source){
  return /(crispr|genom|transcript|gene expression|breeding|cultivar|yield|salinity|salt stress|whitefly|aphid|insect|plant growth|agronom|pesticide residue|herbicide|fungicide)/i.test(agriculturalText(source));
}
function safetyText(source){
  return /(safety|toxic|adverse|allerg|pesticide|residue|contamin|poison|risk|hazard)/i.test(agriculturalText(source));
}
function sourcePriority(source,item){
  let score=0;
  if(source.topicSpecific===true)score+=10;
  if(['official','guideline','nutrition-database'].includes(source.kind))score+=8;
  else if(['systematic-review','trial'].includes(source.kind))score+=6;
  if(['authorization','nutrition','safety','health'].includes(source.role))score+=4;
  if(item?.domain==='medicine'&&source.role==='authorization')score+=8;
  if(item?.domain==='food'&&source.role==='nutrition')score+=6;
  if(looksAgricultural(source)&&source.role==='health')score-=5;
  return score;
}
export function selectPlanSources(evidence,item,max=7){
  const ranked=[...(evidence?.sources??[])].sort((a,b)=>sourcePriority(b,item)-sourcePriority(a,item));
  const chosen=[],seen=new Set();
  const take=source=>{if(source&&!seen.has(source.id)&&chosen.length<max){seen.add(source.id);chosen.push(source);}};
  const roleOrder=item?.domain==='medicine'?['authorization','safety','health']
    :item?.domain==='food'?['nutrition','safety','health']
    :item?.domain==='disease'?['health','safety']
    :['health','nutrition','safety'];
  for(const role of roleOrder)take(ranked.find(s=>s.role===role));
  take(ranked.find(s=>s.topicSpecific===true));
  for(const source of ranked)take(source);
  return chosen;
}

function planSchema(skeleton,sources){
  const sourceIds=sources.map(s=>s.id);
  const ids=skeleton.map(s=>s.id);
  return {type:'object',additionalProperties:false,required:['primaryQuestion','readerSituation','nextActions','sections'],properties:{
    primaryQuestion:{type:'string',minLength:12,maxLength:220},
    readerSituation:{type:'string',minLength:12,maxLength:220},
    nextActions:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:10,maxLength:140}},
    sections:{type:'array',minItems:skeleton.length,maxItems:skeleton.length,items:{type:'object',additionalProperties:false,required:['id','heading','question','claims'],properties:{
      id:{type:'string',enum:ids},
      heading:{type:'string',minLength:4,maxLength:90},
      question:{type:'string',minLength:8,maxLength:160},
      claims:{type:'array',minItems:1,maxItems:2,items:{type:'object',additionalProperties:false,required:['id','text','type','risk','sourceIds'],properties:{
        id:{type:'string',pattern:'^c[0-9]{1,2}$'},
        text:{type:'string',minLength:8,maxLength:180},
        type:{type:'string',enum:CLAIM_TYPES},
        risk:{type:'string',enum:['low','high']},
        sourceIds:{type:'array',minItems:1,maxItems:3,items:{type:'string',enum:sourceIds}}
      }}}
    }}}
  }};
}
function normalizePlanToSkeleton(plan,skeleton){
  const byId=new Map((plan?.sections??[]).map(section=>[section.id,section]));
  return {...plan,sections:skeleton.map(base=>{
    const generated=byId.get(base.id);
    return generated?{...generated,id:base.id,modules:[...base.modules]}:{...base,claims:[]};
  })};
}
function sourceBundle(sources){
  return sources.map(s=>({
    id:s.id,title:s.title,kind:s.kind,role:s.role,topicSpecific:s.topicSpecific===true,
    scopeNote:s.scopeNote,notes:String(s.notes??'').slice(0,1200)
  }));
}
function normalizedNumbers(text){
  const out=[];
  for(const match of String(text??'').matchAll(/\b\d+(?:[.,]\d+)?(?:\s*(?:kcal|mg|mcg|μg|µg|g|kg|ml|mL|l|L|%|회|일|주|개월|년|℃|°C))?/g)){
    const raw=match[0].replace(/,/g,'').replace(/\s+/g,'').replace(/µg|μg/g,'mcg').toLowerCase();
    const n=Number(raw.match(/^\d+(?:\.\d+)?/)?.[0]);
    if(Number.isInteger(n)&&n>=1900&&n<=2100&&(/^\d{4}(?:년)?$/.test(raw)))continue;
    out.push(raw);
  }
  return [...new Set(out)];
}
function sourceText(source){return norm(`${source?.title??''} ${source?.scopeNote??''} ${source?.notes??''}`).replace(/,/g,'').replace(/\s+/g,'').replace(/µg|μg/g,'mcg').toLowerCase();}
function sourceSupportsClaim(source,claim){
  if(!source)return false;
  if(claim.type==='nutrition')return source.role==='nutrition'||source.kind==='nutrition-database'||(source.role==='health'&&!looksAgricultural(source));
  if(claim.type==='safety')return ['safety','authorization'].includes(source.role)||safetyText(source);
  if(claim.type==='dose')return ['official','guideline','trial'].includes(source.kind)&&['authorization','safety','health'].includes(source.role);
  if(claim.type==='interaction')return ['official','guideline','systematic-review','trial'].includes(source.kind)&&['authorization','safety','health'].includes(source.role);
  if(['disease','treatment'].includes(claim.type))return ['official','guideline','systematic-review','trial'].includes(source.kind)&&['health','authorization'].includes(source.role)&&!looksAgricultural(source);
  if(claim.type==='benefit')return source.role==='health'&&!looksAgricultural(source)&&(['official','guideline','systematic-review','trial'].includes(source.kind)||(source.kind==='article'&&source.topicSpecific===true));
  return source.topicSpecific===true||['official','guideline','nutrition-database'].includes(source.kind);
}
function highRiskClaim(claim){
  return claim?.risk==='high'||HIGH_RISK_TYPES.has(claim?.type)||/(질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u.test(claim?.text??'');
}
export function validateEvidencePlan(item,evidence,plan,scope,sources=selectPlanSources(evidence,item)){
  const failures=[],sourceById=new Map(sources.map(s=>[s.id,s])),skeleton=buildCoreSkeleton(item);
  if(!plan||!Array.isArray(plan.sections)||plan.sections.length!==skeleton.length)failures.push({code:'PLAN_SECTION_COUNT'});
  const expectedById=new Map(skeleton.map(s=>[s.id,s])),sectionIds=new Set(),claimIds=new Set(),covered=new Set();
  for(const section of plan?.sections??[]){
    if(sectionIds.has(section.id)||!expectedById.has(section.id))failures.push({code:'PLAN_SECTION_ID',sectionId:section.id});sectionIds.add(section.id);
    const expected=expectedById.get(section.id);
    if(expected){
      for(const module of expected.modules)covered.add(module);
      if(JSON.stringify(section.modules??[])!==JSON.stringify(expected.modules))failures.push({code:'PLAN_SKELETON_MODULES',sectionId:section.id});
    }
    for(const claim of section.claims??[]){
      if(claimIds.has(claim.id))failures.push({code:'PLAN_CLAIM_ID',claimId:claim.id});claimIds.add(claim.id);
      const cited=(claim.sourceIds??[]).map(id=>sourceById.get(id)).filter(Boolean);
      if(!cited.length||cited.length!==(claim.sourceIds??[]).length){failures.push({code:'PLAN_SOURCE',claimId:claim.id});continue;}
      if(!cited.some(source=>sourceSupportsClaim(source,claim)))failures.push({code:'PLAN_SCOPE',claimId:claim.id,type:claim.type});
      if(highRiskClaim(claim)&&!cited.some(source=>['official','guideline','systematic-review','trial'].includes(source.kind)&&!looksAgricultural(source)))failures.push({code:'PLAN_HIGH_RISK_SOURCE',claimId:claim.id,type:claim.type});
      for(const token of normalizedNumbers(claim.text))if(!cited.some(source=>sourceText(source).includes(token)))failures.push({code:'PLAN_NUMBER_SOURCE',claimId:claim.id,token});
    }
  }
  for(const section of skeleton)if(!sectionIds.has(section.id))failures.push({code:'PLAN_SKELETON_SECTION',sectionId:section.id});
  for(const module of DOMAIN_RULES[item.domain].core)if(!covered.has(module))failures.push({code:'PLAN_CORE_MODULE',module});
  return failures;
}

async function requestPlan(item,evidence,scope,required,sources,skeleton,{model,fetcher,currentTitle,repair=null}){
  const [min,max]=lengthBandForScope(scope);
  const baseSystem=`한국어 건강정보 편집 설계자다. 본문을 쓰지 말고 근거 기반 작성 계획만 만든다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 검색 범위는 ${scope}, 권장 공개 본문은 ${min}~${max}자이며 글자수를 채우기 위한 내용을 만들지 않는다. section id는 제공된 coreSkeleton을 정확히 한 번씩 사용한다. 모듈 배치는 코드가 결정하므로 modules를 출력하지 않는다. 각 섹션은 자료로 직접 뒷받침되는 핵심 주장 1~2개만 둔다. 수치는 인용한 source notes에 같은 값과 단위가 실제로 존재할 때만 쓴다. 근거에 없는 수치·기간·비율은 삭제하고 정성 설명으로 바꾼다. 질병 예방·치료·용량·상호작용은 직접적인 공식·가이드라인·체계적 문헌고찰·임상시험 근거가 없으면 주장하지 않는다. 농업·유전학 자료를 사람 효능으로 확대하지 않는다. JSON만 출력한다.`;
  const repairSystem=repair?` 이전 plan은 코드 검증에 실패했다. failures에 적힌 문제만 고친다. 특히 PLAN_NUMBER_SOURCE는 근거 없는 숫자를 제거하거나 source에 실제 있는 숫자로만 교체하고, PLAN_SCOPE/PLAN_HIGH_RISK_SOURCE는 근거 수준을 낮추지 말고 unsupported 주장을 삭제·완화한다. section을 빼거나 coreSkeleton을 바꾸지 않는다.`:'';
  return ollamaJson([
    {role:'system',content:baseSystem+repairSystem},
    {role:'user',content:JSON.stringify({keyword:item.keyword,currentTitle,domain:item.domain,scope,requiredCoreModules:required,coreSkeleton:skeleton,sources:sourceBundle(sources),repair})}
  ],planSchema(skeleton,sources),{model,fetcher,numPredict:repair?1600:(scope==='deep'?2400:scope==='comprehensive'?2100:1800),numCtx:12288});
}

export async function planArticle(item,evidence,{model,fetcher=fetch,currentTitle=''}={}){
  const scope=inferWritingScope(item,currentTitle),required=[...DOMAIN_RULES[item.domain].core],sources=selectPlanSources(evidence,item),skeleton=buildCoreSkeleton(item);
  let rawPlan=await requestPlan(item,evidence,scope,required,sources,skeleton,{model,fetcher,currentTitle});
  let plan=normalizePlanToSkeleton(rawPlan,skeleton);
  let failures=validateEvidencePlan(item,evidence,plan,scope,sources);
  const initialPlan=plan,initialFailures=failures;
  let repaired=false;
  if(failures.length){
    rawPlan=await requestPlan(item,evidence,scope,required,sources,skeleton,{model,fetcher,currentTitle,repair:{failures,plan}});
    plan=normalizePlanToSkeleton(rawPlan,skeleton);
    failures=validateEvidencePlan(item,evidence,plan,scope,sources);
    repaired=true;
  }
  return {plan,scope,required,sources,skeleton,failures,repaired,initialPlan,initialFailures};
}

