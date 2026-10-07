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

function planSchema(scope,required,sources){
  const [minSections,maxSections]=sectionLimitsForScope(scope);
  const sourceIds=sources.map(s=>s.id),moduleNames=Object.keys(MODULES);
  return {type:'object',additionalProperties:false,required:['primaryQuestion','readerSituation','nextActions','sections'],properties:{
    primaryQuestion:{type:'string',minLength:12,maxLength:220},
    readerSituation:{type:'string',minLength:12,maxLength:220},
    nextActions:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:10,maxLength:140}},
    sections:{type:'array',minItems:minSections,maxItems:maxSections,items:{type:'object',additionalProperties:false,required:['id','heading','question','modules','claims'],properties:{
      id:{type:'string',pattern:'^[a-z][a-z0-9-]{1,40}$'},
      heading:{type:'string',minLength:6,maxLength:90},
      question:{type:'string',minLength:8,maxLength:160},
      modules:{type:'array',minItems:1,maxItems:4,items:{type:'string',enum:moduleNames}},
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
function highRiskClaim(claim){
  return claim?.risk==='high'||HIGH_RISK_TYPES.has(claim?.type)||/(질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u.test(claim?.text??'');
}
export function validateEvidencePlan(item,evidence,plan,scope,sources=selectPlanSources(evidence,item)){
  const failures=[],sourceById=new Map(sources.map(s=>[s.id,s]));
  const [minSections,maxSections]=sectionLimitsForScope(scope);
  if(!plan||!Array.isArray(plan.sections)||plan.sections.length<minSections||plan.sections.length>maxSections)failures.push({code:'PLAN_SECTION_COUNT'});
  const sectionIds=new Set(),claimIds=new Set(),covered=new Set();
  for(const section of plan?.sections??[]){
    if(sectionIds.has(section.id))failures.push({code:'PLAN_SECTION_ID',sectionId:section.id});sectionIds.add(section.id);
    for(const module of section.modules??[])covered.add(module);
    for(const claim of section.claims??[]){
      if(claimIds.has(claim.id))failures.push({code:'PLAN_CLAIM_ID',claimId:claim.id});claimIds.add(claim.id);
      const cited=(claim.sourceIds??[]).map(id=>sourceById.get(id)).filter(Boolean);
      if(!cited.length||cited.length!==(claim.sourceIds??[]).length){failures.push({code:'PLAN_SOURCE',claimId:claim.id});continue;}
      if(!cited.some(source=>sourceSupportsClaim(source,claim)))failures.push({code:'PLAN_SCOPE',claimId:claim.id,type:claim.type});
      if(highRiskClaim(claim)&&!cited.some(source=>['official','guideline','systematic-review','trial'].includes(source.kind)&&!looksAgricultural(source)))failures.push({code:'PLAN_HIGH_RISK_SOURCE',claimId:claim.id,type:claim.type});
      for(const token of normalizedNumbers(claim.text))if(!cited.some(source=>sourceText(source).includes(token)))failures.push({code:'PLAN_NUMBER_SOURCE',claimId:claim.id,token});
    }
  }
  for(const module of DOMAIN_RULES[item.domain].core)if(!covered.has(module))failures.push({code:'PLAN_CORE_MODULE',module});
  return failures;
}

export async function planArticle(item,evidence,{model,fetcher=fetch,currentTitle=''}={}){
  const scope=inferWritingScope(item,currentTitle),required=[...DOMAIN_RULES[item.domain].core],sources=selectPlanSources(evidence,item);
  const [min,max]=lengthBandForScope(scope),[minSections,maxSections]=sectionLimitsForScope(scope);
  const plan=await ollamaJson([
    {role:'system',content:`한국어 건강정보 편집 설계자다. 본문을 쓰지 말고 근거 기반 작성 계획만 만든다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 검색 범위는 ${scope}, 권장 공개 본문은 ${min}~${max}자이며 글자수를 채우기 위한 섹션을 만들지 않는다. 섹션은 ${minSections}~${maxSections}개 범위에서 서로 다른 검색 질문만 둔다. 필수 core 모듈 ${required.join(', ')}를 자연스럽게 모두 커버한다. 각 섹션은 실제 자료로 뒷받침되는 핵심 주장 1~2개만 둔다. 수치·영양성분·효능·안전·용량·상호작용·질병·치료 주장은 sourceIds와 직접 맞아야 한다. 농약·농업·유전학 자료는 실제 안전·재배 범위 밖의 사람 효능으로 확대하지 않는다. 사람 연구도 연구대상·형태·용량·기간·결과와 맞지 않으면 예방·치료 주장으로 승인하지 않는다. 근거가 약한 선택 질문은 제외한다. JSON만 출력한다.`},
    {role:'user',content:JSON.stringify({keyword:item.keyword,currentTitle,domain:item.domain,scope,requiredCoreModules:required,sources:sourceBundle(sources)})}
  ],planSchema(scope,required,sources),{model,fetcher,numPredict:scope==='deep'?2800:scope==='comprehensive'?2400:2000,numCtx:12288});
  return {plan,scope,required,sources,failures:validateEvidencePlan(item,evidence,plan,scope,sources)};
}
