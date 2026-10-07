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
      claims:{type:'array',minItems:1,maxItems:2,items:{type:'object',additionalProperties:false,required:['id','text','sourceIds'],properties:{
        id:{type:'string',pattern:'^c[0-9]{1,2}
    }}}
  }};
}
const SECTION_CLAIM_TYPES=Object.freeze({
  food:{
    'identity-nutrition':['general','nutrition'],
    'benefits-amount':['benefit','general'],
    'preparation-storage':['general','safety'],
    'selection-safety':['safety','general'],
    decision:['general'],
  },
  nutrient:{
    'identity-role':['general'],
    'benefits-expectations':['benefit','general'],
    'audience-amount-use':['general','dose'],
    'safety-interactions':['safety','interaction'],
    'selection-decision':['general','safety'],
  },
  medicine:{
    'identity-indications':['general'],
    'audience-amount-use':['dose','general'],
    timeline:['general'],
    'safety-contraindications-interactions':['safety','interaction'],
    'medical-help':['safety','general'],
    'storage-decision':['general'],
  },
  disease:{
    'identity-symptoms':['disease','general'],
    'causes-risk':['disease','general'],
    'self-check-diagnosis':['disease','general'],
    'treatment-home-care':['treatment','general'],
    'red-flags-medical-help':['disease','safety'],
    decision:['general'],
  },
});
function deterministicClaimType(item,section,text){
  const value=norm(text);
  const uncertainty=/(?:단정하지|확인되지|근거가 부족|근거가 충분하지|자료가 없|자료만으로는|알 수 없)/u.test(value);
  if(uncertainty)return 'general';
  if(/(?:상호작용|병용|함께 복용|동시 복용)/u.test(value))return 'interaction';
  if(['medicine','nutrient'].includes(item?.domain)&&/(?:복용량|용량|투여량|1회|하루\s*\d+|\d+(?:[.,]\d+)?\s*(?:mg|mcg|μg|µg|ml|mL))/iu.test(value))return 'dose';
  if(['medicine','disease'].includes(item?.domain)&&/(?:치료|치료법|완치)/u.test(value))return 'treatment';
  if(['medicine','disease'].includes(item?.domain)&&/(?:질병|진단|예방|발병|증상(?:을)?\s*(?:개선|완화)|위험(?:을|이)?\s*(?:낮|높|증가|감소))/u.test(value))return 'disease';
  const allowed=SECTION_CLAIM_TYPES[item?.domain]?.[section?.id]??['general'];
  if(allowed.includes('nutrition')&&/(?:kcal|칼로리|영양|단백질|탄수화물|지방|식이섬유|비타민|미네랄|나트륨|칼륨|철|칼슘|\d+(?:[.,]\d+)?\s*(?:g|mg|mcg|μg|µg|%))/iu.test(value))return 'nutrition';
  if(allowed.includes('safety')&&/(?:주의|안전|위험|알레르기|부작용|변질|오염|세척|피해야|금기)/u.test(value))return 'safety';
  if(allowed.includes('benefit')&&/(?:도움|효과|기대|관련|개선|유지|지원)/u.test(value))return 'benefit';
  return allowed[0]??'general';
}
function deterministicClaimRisk(type,text){
  return HIGH_RISK_TYPES.has(type)||/(?:질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u.test(text??'')?'high':'low';
}
function sourceScoreForClaim(source,claim,item){
  let score=sourcePriority(source,item);
  if(sourceSupportsClaim(source,claim))score+=20;
  if(claim.type==='nutrition'&&source.role==='nutrition')score+=12;
  if(claim.type==='safety'&&['safety','authorization'].includes(source.role))score+=12;
  if(['benefit','disease','treatment'].includes(claim.type)&&source.role==='health')score+=10;
  if(claim.type==='interaction'&&['authorization','safety','health'].includes(source.role))score+=10;
  return score;
}
function normalizedClaimSources(item,claim,sources){
  let candidates=sources.filter(source=>sourceSupportsClaim(source,claim));
  if(deterministicClaimRisk(claim.type,claim.text)==='high')candidates=candidates.filter(source=>['official','guideline','systematic-review','trial'].includes(source.kind)&&!looksAgricultural(source));
  candidates.sort((a,b)=>sourceScoreForClaim(b,claim,item)-sourceScoreForClaim(a,claim,item));
  const allowed=new Set(candidates.map(source=>source.id));
  const existing=[...new Set((claim.sourceIds??[]).filter(id=>allowed.has(id)))];
  return (existing.length?existing:candidates.map(source=>source.id)).slice(0,3);
}
function fallbackClaimText(item,section){
  const subject=item?.keyword??'이 항목';
  const map={
    'identity-nutrition':`${subject}의 영양 정보는 확인된 자료의 범위와 식품 형태를 구분해 살펴봅니다.`,
    'benefits-amount':`${subject}의 섭취 관련 판단은 확인된 자료 범위 안에서만 설명합니다.`,
    'preparation-storage':`${subject}의 조리와 보관은 확인된 자료의 적용 조건을 기준으로 살펴봅니다.`,
    'selection-safety':`${subject}의 선택과 주의사항은 확인된 자료 범위만 설명하고 확인되지 않은 내용은 단정하지 않습니다.`,
    'decision':`${subject}은 확인된 근거와 개인 상황을 구분해 선택합니다.`,
    'identity-role':`${subject}의 정체와 역할은 확인된 자료의 적용 범위 안에서 설명합니다.`,
    'benefits-expectations':`${subject}의 연구 결과는 확인된 범위를 넘어서 단정하지 않습니다.`,
    'audience-amount-use':`${subject}의 대상과 사용법은 확인된 자료가 있는 범위에서만 설명합니다.`,
    'safety-interactions':`${subject}의 주의사항은 확인된 자료 범위만 설명하고 확인되지 않은 상호작용은 단정하지 않습니다.`,
    'selection-decision':`${subject}은 확인된 자료와 개인 상황을 함께 구분해 판단합니다.`,
  };
  return map[section.id]??`${subject}은 확인된 근거 범위 안에서만 설명합니다.`;
}
function normalizePlanToSkeleton(plan,skeleton,item,sources){
  const byId=new Map((plan?.sections??[]).map(section=>[section.id,section]));
  return {...plan,sections:skeleton.map(base=>{
    const generated=byId.get(base.id)??base;
    let claims=(generated.claims??[]).map(claim=>{
      const type=deterministicClaimType(item,base,claim.text);
      const typed={...claim,type,risk:deterministicClaimRisk(type,claim.text)};
      return {...typed,sourceIds:normalizedClaimSources(item,typed,sources)};
    });
    const sourceById=new Map(sources.map(source=>[source.id,source]));
    claims=claims.filter(claim=>{
      if(highRiskClaim(claim))return true;
      const cited=(claim.sourceIds??[]).map(id=>sourceById.get(id)).filter(Boolean);
      return !normalizedNumbers(claim.text).some(token=>!cited.some(source=>sourceText(source).includes(token)));
    });
    if(!claims.length){
      const id=(generated.claims??[])[0]?.id??`c${skeleton.indexOf(base)+1}`;
      const text=fallbackClaimText(item,base);
      const type=deterministicClaimType(item,base,text);
      const claim={id,text,type,risk:deterministicClaimRisk(type,text),sourceIds:[]};
      claim.sourceIds=normalizedClaimSources(item,claim,sources);
      claims=[claim];
    }
    return {...generated,id:base.id,modules:[...base.modules],claims};
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

function failedClaimIds(failures){
  return [...new Set((failures??[]).map(f=>f.claimId).filter(Boolean))];
}
function repairClaimSchema(ids,sources){
  return {type:'object',additionalProperties:false,required:['claims'],properties:{
    claims:{type:'array',minItems:ids.length,maxItems:ids.length,items:{type:'object',additionalProperties:false,required:['id','text','sourceIds'],properties:{
      id:{type:'string',enum:ids},
      text:{type:'string',minLength:8,maxLength:180},
      sourceIds:{type:'array',minItems:1,maxItems:3,items:{type:'string',enum:sources.map(s=>s.id)}}
    }}}
  }};
}
async function repairFailedClaims(item,evidence,plan,failures,sources,{model,fetcher}){
  const ids=failedClaimIds(failures);
  if(!ids.length)return plan;
  const byId=new Map(plan.sections.flatMap(section=>section.claims.map(claim=>[claim.id,{sectionId:section.id,claim}])));
  const targets=ids.map(id=>byId.get(id)).filter(Boolean).map(({sectionId,claim})=>({
    id:claim.id,sectionId,text:claim.text,failures:failures.filter(f=>f.claimId===claim.id),
    candidateSourceIds:sources.filter(source=>sourceSupportsClaim(source,claim)).sort((a,b)=>sourceScoreForClaim(b,claim,item)-sourceScoreForClaim(a,claim,item)).slice(0,5).map(source=>source.id)
  }));
  if(!targets.length)return plan;
  const repaired=await ollamaJson([
    {role:'system',content:'한국어 Evidence Plan의 실패 claim만 짧게 고친다. 새 사실을 추가하지 않는다. PLAN_NUMBER_SOURCE면 근거에 없는 숫자·기간·비율을 모두 제거하고 정성 문장으로 바꾼다. PLAN_SCOPE면 candidateSourceIds가 직접 뒷받침할 수 있는 범위로 문장을 낮춘다. PLAN_HIGH_RISK_SOURCE면 질병 예방·치료·용량·상호작용 단정을 삭제하거나 직접 강한 근거가 있는 범위로만 제한한다. 다른 claim은 출력하지 않는다. JSON만 출력한다.'},
    {role:'user',content:JSON.stringify({keyword:item.keyword,canonicalSubject:`${item.keyword} = ${evidence.query}`,targets,sources:sourceBundle(sources)})}
  ],repairClaimSchema(targets.map(t=>t.id),sources),{model,fetcher,numPredict:Math.min(900,300+targets.length*140),numCtx:8192});
  const patches=new Map((repaired.claims??[]).map(claim=>[claim.id,claim]));
  return {...plan,sections:plan.sections.map(section=>({...section,claims:section.claims.map(claim=>patches.has(claim.id)?{...claim,...patches.get(claim.id)}:claim)}))};
}

async function requestPlan(item,evidence,scope,required,sources,skeleton,{model,fetcher,currentTitle}){
  const [min,max]=lengthBandForScope(scope);
  const nutritionAvailable=item.domain!=='food'||evidence?.nutrition?.available===true;
  const nutritionInstruction=nutritionAvailable
    ?'공식 영양 DB가 포함된 경우에만 그 source의 실제 수치와 단위를 사용할 수 있다.'
    :'이번 근거 묶음에는 공식 영양 DB가 없다. identity-nutrition 섹션은 숫자형 영양성분을 만들지 말고, 확인 가능한 정성 정보와 근거 한계를 설명한다. nutrition 타입의 수치 주장을 만들지 않는다.';
  const evidenceInstruction=evidence?.evidenceProfile?.claimMode==='conservative'
    ?'현재 근거 강도가 제한적이므로 효능·권장량·안전성·상호작용을 새로 주장하지 말고, 확인된 연구 범위와 불확실성을 설명하는 정성 claim을 우선한다.'
    :'직접 근거가 있는 claim만 작성한다.';
  const baseSystem=`한국어 건강정보 편집 설계자다. 본문을 쓰지 말고 근거 기반 작성 계획만 만든다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 검색 범위는 ${scope}, 권장 공개 본문은 ${min}~${max}자이며 글자수를 채우기 위한 내용을 만들지 않는다. section id는 제공된 coreSkeleton을 정확히 한 번씩 사용한다. 모듈 배치는 코드가 결정하므로 modules를 출력하지 않는다. 각 섹션은 자료로 직접 뒷받침되는 핵심 주장 1~2개만 둔다. 수치는 인용한 source notes에 같은 값과 단위가 실제로 존재할 때만 쓴다. 근거에 없는 수치·기간·비율은 삭제하고 정성 설명으로 바꾼다. ${nutritionInstruction} ${evidenceInstruction} 질병 예방·치료·용량·상호작용은 직접적인 공식·가이드라인·체계적 문헌고찰·임상시험 근거가 없으면 주장하지 않는다. 농업·유전학 자료를 사람 효능으로 확대하지 않는다. JSON만 출력한다.`;
  return ollamaJson([
    {role:'system',content:baseSystem},
    {role:'user',content:JSON.stringify({keyword:item.keyword,currentTitle,domain:item.domain,scope,requiredCoreModules:required,coreSkeleton:skeleton,nutritionEvidence:evidence?.nutrition??null,sources:sourceBundle(sources)})}
  ],planSchema(skeleton,sources),{model,fetcher,numPredict:scope==='deep'?2400:scope==='comprehensive'?2100:1800,numCtx:12288});
}

export async function planArticle(item,evidence,{model,fetcher=fetch,currentTitle=''}={}){
  const scope=inferWritingScope(item,currentTitle),required=[...DOMAIN_RULES[item.domain].core],sources=selectPlanSources(evidence,item),skeleton=buildCoreSkeleton(item);
  const rawPlan=await requestPlan(item,evidence,scope,required,sources,skeleton,{model,fetcher,currentTitle});
  let plan=normalizePlanToSkeleton(rawPlan,skeleton,item,sources);
  let failures=validateEvidencePlan(item,evidence,plan,scope,sources);
  const initialPlan=plan,initialFailures=failures;
  let repaired=false;
  if(failures.length){
    plan=await repairFailedClaims(item,evidence,plan,failures,sources,{model,fetcher});
    plan=normalizePlanToSkeleton(plan,skeleton,item,sources);
    failures=validateEvidencePlan(item,evidence,plan,scope,sources);
    repaired=true;
  }
  return {plan,scope,required,sources,skeleton,failures,repaired,initialPlan,initialFailures};
}

},
        text:{type:'string',minLength:8,maxLength:180},
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
  const nutritionAvailable=item.domain!=='food'||evidence?.nutrition?.available===true;
  const nutritionInstruction=nutritionAvailable
    ?'공식 영양 DB가 포함된 경우에만 그 source의 실제 수치와 단위를 사용할 수 있다.'
    :'이번 근거 묶음에는 공식 영양 DB가 없다. identity-nutrition 섹션은 숫자형 영양성분을 만들지 말고, 확인 가능한 정성 정보와 근거 한계를 설명한다. nutrition 타입의 수치 주장을 만들지 않는다.';
  const baseSystem=`한국어 건강정보 편집 설계자다. 본문을 쓰지 말고 근거 기반 작성 계획만 만든다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 검색 범위는 ${scope}, 권장 공개 본문은 ${min}~${max}자이며 글자수를 채우기 위한 내용을 만들지 않는다. section id는 제공된 coreSkeleton을 정확히 한 번씩 사용한다. 모듈 배치는 코드가 결정하므로 modules를 출력하지 않는다. 각 섹션은 자료로 직접 뒷받침되는 핵심 주장 1~2개만 둔다. 수치는 인용한 source notes에 같은 값과 단위가 실제로 존재할 때만 쓴다. 근거에 없는 수치·기간·비율은 삭제하고 정성 설명으로 바꾼다. ${nutritionInstruction} 질병 예방·치료·용량·상호작용은 직접적인 공식·가이드라인·체계적 문헌고찰·임상시험 근거가 없으면 주장하지 않는다. 농업·유전학 자료를 사람 효능으로 확대하지 않는다. JSON만 출력한다.`;
  const repairSystem=repair?` 이전 plan은 코드 검증에 실패했다. failures에 적힌 문제만 고친다. 특히 PLAN_NUMBER_SOURCE는 근거 없는 숫자를 제거하거나 source에 실제 있는 숫자로만 교체하고, PLAN_SCOPE/PLAN_HIGH_RISK_SOURCE는 근거 수준을 낮추지 말고 unsupported 주장을 삭제·완화한다. 공식 영양 DB가 없으면 nutrition 관련 숫자는 모두 제거한다. section을 빼거나 coreSkeleton을 바꾸지 않는다.`:'';
  return ollamaJson([
    {role:'system',content:baseSystem+repairSystem},
    {role:'user',content:JSON.stringify({keyword:item.keyword,currentTitle,domain:item.domain,scope,requiredCoreModules:required,coreSkeleton:skeleton,nutritionEvidence:evidence?.nutrition??null,sources:sourceBundle(sources),repair})}
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

