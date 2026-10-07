import { ollamaJson } from './queue-ollama.mjs';
import { DOMAIN_RULES } from '../publishing/content-standards.mjs';

export const SCOPE_BANDS=Object.freeze({
  focused:[1200,2200],standard:[2200,3800],comprehensive:[3500,5200],deep:[4500,6500],
});
const CLAIM_TYPES=['general','nutrition','benefit','safety','dose','interaction','disease','treatment'];
const HIGH_RISK_TYPES=new Set(['dose','interaction','disease','treatment']);
const norm=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim();

const SKELETONS=Object.freeze({
  food:[
    ['identity','nutrition'],['benefits','amount'],['preparation','storage'],['selection','safety'],['decision']
  ],
  nutrient:[
    ['identity','role'],['benefits','expectations'],['audience','amount'],['use','interactions'],['safety','selection'],['decision']
  ],
  medicine:[
    ['identity','indications'],['audience','amount','use'],['timeline','storage'],['safety','contraindications'],['interactions'],['medical_help'],['decision']
  ],
  disease:[
    ['identity','symptoms'],['causes','risk'],['self_check','diagnosis'],['treatment','home_care'],['red_flags','medical_help'],['decision']
  ],
});
export function coreSkeleton(domain){
  const groups=SKELETONS[domain];
  if(!groups)throw new Error('E_QUEUE_PLAN_DOMAIN');
  const required=new Set(DOMAIN_RULES[domain].core);
  const covered=new Set(groups.flat());
  for(const module of required)if(!covered.has(module))throw Object.assign(new Error('E_QUEUE_PLAN_SKELETON'),{details:{domain,module}});
  return groups.map((modules,index)=>({id:`core-${index+1}`,modules:[...modules]}));
}
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
export const sectionLimitsForScope=scope=>({focused:[4,7],standard:[5,8],comprehensive:[6,10],deep:[8,12]})[scope]??[5,8];

function agriculturalText(source){return `${source?.title??''} ${source?.notes??''}`.toLowerCase();}
function looksAgricultural(source){return /(crispr|genom|transcript|gene expression|breeding|cultivar|yield|salinity|salt stress|whitefly|aphid|insect|plant growth|agronom|pesticide residue|herbicide|fungicide)/i.test(agriculturalText(source));}
function safetyText(source){return /(safety|toxic|adverse|allerg|pesticide|residue|contamin|poison|risk|hazard)/i.test(agriculturalText(source));}
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
    :item?.domain==='disease'?['health','safety']:['health','nutrition','safety'];
  for(const role of roleOrder)take(ranked.find(s=>s.role===role));
  take(ranked.find(s=>s.topicSpecific===true));
  for(const source of ranked)take(source);
  return chosen;
}
function planSchema(skeleton,sources){
  const sourceIds=sources.map(s=>s.id),ids=skeleton.map(s=>s.id);
  return {type:'object',additionalProperties:false,required:['primaryQuestion','readerSituation','nextActions','sections'],properties:{
    primaryQuestion:{type:'string',minLength:12,maxLength:220},
    readerSituation:{type:'string',minLength:12,maxLength:220},
    nextActions:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:10,maxLength:140}},
    sections:{type:'array',minItems:ids.length,maxItems:ids.length,items:{type:'object',additionalProperties:false,required:['id','heading','question','claims'],properties:{
      id:{type:'string',enum:ids},heading:{type:'string',minLength:6,maxLength:90},question:{type:'string',minLength:8,maxLength:160},
      claims:{type:'array',minItems:1,maxItems:2,items:{type:'object',additionalProperties:false,required:['id','text','type','risk','sourceIds'],properties:{
        id:{type:'string',pattern:'^c[0-9]{1,2}$'},text:{type:'string',minLength:8,maxLength:180},type:{type:'string',enum:CLAIM_TYPES},
        risk:{type:'string',enum:['low','high']},sourceIds:{type:'array',minItems:1,maxItems:3,items:{type:'string',enum:sourceIds}}
      }}}
    }}}
  }};
}
function sourceBundle(sources){return sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,topicSpecific:s.topicSpecific===true,scopeNote:s.scopeNote,notes:String(s.notes??'').slice(0,1200)}));}
function normalizedNumbers(text){
  const out=[];
  for(const match of String(text??'').matchAll(/\b\d+(?:[.,]\d+)?(?:\s*(?:kcal|mg|mcg|μg|µg|g|kg|ml|mL|l|L|%|회|일|주|개월|년|℃|°C))?/g)){
    const raw=match[0].replace(/,/g,'').replace(/\s+/g,'').replace(/µg|μg/g,'mcg').toLowerCase();
    const n=Number(raw.match(/^\d+(?:\.\d+)?/)?.[0]);
    if(Number.isInteger(n)&&n>=1900&&n<=2100&&!/[a-z%℃°가-힣]/i.test(raw.replace(/^\d+(?:\.\d+)?/,'')))continue;
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
function highRiskClaim(claim){return claim?.risk==='high'||HIGH_RISK_TYPES.has(claim?.type)||/(질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u.test(claim?.text??'');}
function attachSkeleton(plan,skeleton){
  const byId=new Map((plan?.sections??[]).map(s=>[s.id,s]));
  return {...plan,sections:skeleton.map(slot=>({...byId.get(slot.id),id:slot.id,modules:[...slot.modules]}))};
}
export function validateEvidencePlan(item,evidence,plan,_scope,sources=selectPlanSources(evidence,item)){
  const failures=[],sourceById=new Map(sources.map(s=>[s.id,s])),skeleton=coreSkeleton(item.domain);
  if(!plan||!Array.isArray(plan.sections)||plan.sections.length!==skeleton.length)failures.push({code:'PLAN_SECTION_COUNT'});
  const expected=new Set(skeleton.map(s=>s.id)),sectionIds=new Set(),claimIds=new Set();
  for(const section of plan?.sections??[]){
    if(!expected.has(section.id)||sectionIds.has(section.id))failures.push({code:'PLAN_SECTION_ID',sectionId:section.id});sectionIds.add(section.id);
    for(const claim of section.claims??[]){
      if(claimIds.has(claim.id))failures.push({code:'PLAN_CLAIM_ID',claimId:claim.id});claimIds.add(claim.id);
      const cited=(claim.sourceIds??[]).map(id=>sourceById.get(id)).filter(Boolean);
      if(!cited.length||cited.length!==(claim.sourceIds??[]).length){failures.push({code:'PLAN_SOURCE',claimId:claim.id,sectionId:section.id});continue;}
      if(!cited.some(source=>sourceSupportsClaim(source,claim)))failures.push({code:'PLAN_SCOPE',claimId:claim.id,type:claim.type,sectionId:section.id});
      if(highRiskClaim(claim)&&!cited.some(source=>['official','guideline','systematic-review','trial'].includes(source.kind)&&!looksAgricultural(source)))failures.push({code:'PLAN_HIGH_RISK_SOURCE',claimId:claim.id,type:claim.type,sectionId:section.id});
      for(const token of normalizedNumbers(claim.text))if(!cited.some(source=>sourceText(source).includes(token)))failures.push({code:'PLAN_NUMBER_SOURCE',claimId:claim.id,token,sectionId:section.id});
    }
  }
  return failures;
}
async function generatePlan(item,evidence,scope,skeleton,sources,{model,fetcher,currentTitle,repairOf=null}){
  const [min,max]=lengthBandForScope(scope);
  const system=repairOf
    ? `근거 기반 작성 계획을 1회 교정한다. 본문은 쓰지 않는다. section id와 modules는 코드가 고정했으므로 바꾸지 않는다. 실패한 수치가 출처 본문에 없으면 그 수치를 삭제하고 확인 가능한 정성 표현으로 바꾼다. 근거가 약한 질병·치료·효능 주장은 더 약한 일반 설명으로 바꾸거나 제거한다. 각 section에는 실제 자료로 뒷받침되는 claim 1~2개만 둔다. 새로운 수치나 새로운 효능을 만들지 않는다. JSON만 출력한다.`
    : `한국어 건강정보 편집 설계자다. 본문을 쓰지 말고 근거 기반 작성 계획만 만든다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 권장 공개 본문은 ${min}~${max}자지만 글자수를 채우지 않는다. section 구조와 modules는 코드가 이미 확정했다. 각 section에서 주어진 modules에 답하는 질문과 실제 자료로 뒷받침되는 claim 1~2개만 만든다. 출처에 없는 수치·효능·기간·용량을 만들지 않는다. 농업·유전학 자료를 사람 건강효과로 확대하지 않는다. JSON만 출력한다.`;
  const user={keyword:item.keyword,currentTitle,domain:item.domain,scope,skeleton,sources:sourceBundle(sources)};
  if(repairOf)user.repairOf=repairOf;
  const raw=await ollamaJson([{role:'system',content:system},{role:'user',content:JSON.stringify(user)}],planSchema(skeleton,sources),{model,fetcher,numPredict:scope==='deep'?2200:1800,numCtx:12288});
  return attachSkeleton(raw,skeleton);
}
export async function planArticle(item,evidence,{model,fetcher=fetch,currentTitle=''}={}){
  const scope=inferWritingScope(item,currentTitle),required=[...DOMAIN_RULES[item.domain].core],sources=selectPlanSources(evidence,item),skeleton=coreSkeleton(item.domain);
  let plan=await generatePlan(item,evidence,scope,skeleton,sources,{model,fetcher,currentTitle});
  let failures=validateEvidencePlan(item,evidence,plan,scope,sources),repaired=false;
  if(failures.length){
    plan=await generatePlan(item,evidence,scope,skeleton,sources,{model,fetcher,currentTitle,repairOf:{failures,plan}});
    failures=validateEvidencePlan(item,evidence,plan,scope,sources);repaired=true;
  }
  return {plan,scope,required,sources,skeleton,failures,repaired};
}
