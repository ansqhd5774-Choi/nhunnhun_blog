import sanitizeHtml from 'sanitize-html';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {parseDocument} from 'htmlparser2';
import { research, VERIFIED_ALIASES } from './keywords.mjs';
import { ollamaJson } from './queue-ollama.mjs';
import { todayInSeoul } from '../publishing/content-standards.mjs';
import { EXTENSIONS, TOPIC_ENTITIES, TOPIC_EXTENSIONS, normTopic } from '../publishing/standards/common.mjs';

export const CURATED_QUEUE_QUERIES=Object.freeze({
  '가지':'eggplant','간장':'soy sauce','갈치':'hairtail fish','감자':'potato','계란':'egg','고등어':'mackerel',
  '고추':'chili pepper','그래놀라':'granola','김치':'kimchi','깻잎':'perilla leaf','껌':'chewing gum','닭고기':'chicken meat',
  '대마종자유':'hemp seed oil','땅콩버터':'peanut butter','라임':'lime fruit','레몬에이드':'lemonade','마늘':'garlic','망고':'mango',
  '멜론':'melon','문어':'octopus','미라클베리':'miracle fruit','미역':'Undaria pinnatifida','밀배아':'wheat germ','바나나':'banana',
  '바나나잎':'banana leaf','배':'pear','보리':'barley','복숭아':'peach','브라질너트':'Brazil nut','브로콜리':'broccoli',
  '사탕무':'beetroot','살사 소스':'salsa sauce','생강':'ginger','수박':'watermelon','시나몬':'cinnamon','아마씨':'flaxseed',
  '아몬드버터':'almond butter','아스파라거스':'asparagus','애플사이다비니거':'apple cider vinegar','양파':'onion','연근':'lotus root',
  '연어':'salmon','오미자':'Schisandra chinensis','오이':'cucumber','오트밀':'oatmeal','옥수수':'corn','요구르트':'yogurt',
  '우롱차':'oolong tea','잣':'pine nut','전복':'abalone','참외':'Korean melon','청양고추':'Cheongyang chili pepper',
  '체리':'cherry','치아씨드':'chia seed','치차론':'pork rind','카옌페퍼':'cayenne pepper','카카오':'cocoa','코코넛':'coconut',
  '퀴노아':'quinoa','통밀빵':'whole wheat bread','팔각':'star anise','팜오일':'palm oil','표고버섯':'shiitake mushroom',
  '해삼':'sea cucumber','현미':'brown rice','호박씨':'pumpkin seed',
  '나이아신':'niacin','니아신':'niacin','레시틴':'lecithin','레티놀':'retinol','로즈힙':'rose hip','루테올린':'luteolin',
  '루테인':'lutein','리코펜':'lycopene','마그네슘':'magnesium','마카':'maca','밀크씨슬':'milk thistle','베타글루칸':'beta glucan',
  '베타알라닌':'beta alanine','베타인':'betaine','베타카로틴':'beta carotene','비오틴':'biotin','비타민 A':'vitamin A',
  '비타민 B6':'vitamin B6','산사자':'Crataegus pinnatifida fruit','아연':'zinc','알릴시스테인':'S-allyl cysteine','엽산':'folic acid',
  '지아잔틴':'zeaxanthin','철분':'iron','침향':'agarwood','카르노산':'carnosic acid','카제인':'casein','카테킨':'catechin',
  '커큐민':'curcumin','코엔자임 Q10':'coenzyme Q10','콜레우스 포스콜리':'Coleus forskohlii','크로세틴':'crocetin',
  '클로로필':'chlorophyll','펙틴':'pectin','피크노제놀':'Pycnogenol','홍삼':'red ginseng','효모':'yeast',
  'CPC':'cetylpyridinium chloride','아세트아미노펜':'acetaminophen','인도메타신':'indomethacin',
});

const plain=html=>sanitizeHtml(String(html),{allowedTags:[],allowedAttributes:{}}).replace(/\s+/g,' ').trim();
export function sourceMainText(html) {
  const doc=parseDocument(html);
  const find=(node,name)=>[...(node.name===name?[node]:[]),...(node.children??[]).flatMap(child=>find(child,name))];
  const text=node=>['script','style','nav','header','footer'].includes(node.name)?'':node.type==='text'?node.data:(node.children??[]).map(text).join(' ');
  return text(find(doc,'main')[0]??find(doc,'body')[0]??doc).replace(/\s+/g,' ').trim();
}
const decode=v=>String(v).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const safeId=(host,index)=>`web-${index}-${host.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,28)||'source'}`;

function pageTitle(html,url){
  const og=String(html).match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)||String(html).match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if(og)return decode(og[1]).trim();
  const t=String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return t?decode(plain(t[1])).slice(0,180):new URL(url).hostname;
}
export function externalLinks(html){
  const out=[];
  for(const m of String(html).matchAll(/<a\b[^>]*href=(["'])(https:\/\/[^"']+)\1/gi)){
    let u;try{u=new URL(m[2].replace(/&amp;/g,'&'));}catch{continue;}
    if(u.username||u.password||u.hostname==='nhunnhun.tistory.com'||u.hostname.endsWith('kakaocdn.net')||u.hostname==='commons.wikimedia.org'||u.hostname==='creativecommons.org'||/^pubmed\.(ncbi\.)?nlm\.nih\.gov$/.test(u.hostname))continue;
    u.hash='';out.push(u.href);
  }
  return [...new Set(out)].slice(0,12);
}
export function classifyWebSource(url,domain){
  const host=new URL(url).hostname.toLowerCase();
  if(/^pubmed\.(ncbi\.)?nlm\.nih\.gov$/.test(host))return {kind:'article',role:'context'};
  const official=/\.go\.kr$|\.gov$|\.gov\.uk$|who\.int$|foodsafetykorea\.go\.kr$|nedrug\.mfds\.go\.kr$|mfds\.go\.kr$|nih\.gov$|ncbi\.nlm\.nih\.gov$|cdc\.gov$|fda\.gov$|usda\.gov$|aao\.org$/.test(host);
  const authorization=domain==='medicine'&&(/(?:^|\.)mfds\.go\.kr$/.test(host)||/nedrug\.mfds\.go\.kr$/.test(host));
  const nutrition=domain==='food'&&/(usda\.gov$|foodsafetykorea\.go\.kr$)/.test(host);
  return {kind:official?'official':'article',role:authorization?'authorization':nutrition?'nutrition':'health'};
}
async function fetchSource(url,domain,index,fetcher){
  let response;try{response=await fetcher(url,{headers:{'User-Agent':'Mozilla/5.0 nhunnhun-review-bot'},redirect:'follow',signal:AbortSignal.timeout(25000)});}catch{return null;}
  if(!response.ok)return null;
  const type=(response.headers?.get?.('content-type')||'').toLowerCase();
  if(type&&!/text\/html|text\/plain|application\/xhtml\+xml/.test(type))return null;
  let body;try{body=await response.text();}catch{return null;}
  const notes=sourceMainText(body).slice(0,6000);if(notes.length<120||/checking your browser|verify you are human|enable javascript and cookies/i.test(notes))return null;
  const finalUrl=response.url||url,{kind,role}=classifyWebSource(finalUrl,domain);
  return {id:safeId(new URL(finalUrl).hostname,index),title:pageTitle(body,finalUrl),url:finalUrl,checkedAt:todayInSeoul(),notes,kind,role,scopeNote:'현재 공개 페이지의 본문 발췌를 조회했으며 발췌에 없는 수치·원문 연구 결과·주제별 효과는 확인된 것으로 간주하지 않는다.'};
}
const QUERY_CACHE_VERSION=1;
const queryMemory=new Map();
function queryCachePath(env=process.env){
  const base=env.LOCALAPPDATA||env.HOME||process.cwd();
  return resolve(base,'nhunnhun-queue-cache','keyword-queries.json');
}
async function readQueryCache(){
  if(queryMemory.size)return queryMemory;
  try{
    const parsed=JSON.parse(await readFile(queryCachePath(),'utf8'));
    if(parsed?.version===QUERY_CACHE_VERSION)for(const [key,value] of Object.entries(parsed.entries??{}))if(/^[A-Za-z0-9 ()'.,-]{2,120}$/.test(value))queryMemory.set(key,value);
  }catch{}
  return queryMemory;
}
async function writeQueryCache(){
  const path=queryCachePath();
  try{
    await mkdir(resolve(path,'..'),{recursive:true});
    await writeFile(path,JSON.stringify({version:QUERY_CACHE_VERSION,updatedAt:new Date().toISOString(),entries:Object.fromEntries(queryMemory)},null,2)+'\n');
  }catch{}
}
function queryCacheKey(item){return `${item.domain}:${item.keyword}`;}

const NUTRITION_CACHE_VERSION=1;
const nutritionMemory=new Map();
let demoUsdaCalls=0;
let demoUsdaCircuitOpenUntil=0;
const DEMO_USDA_SAFE_CALLS=20;
function nutritionCachePath(env=process.env){
  const base=env.LOCALAPPDATA||env.HOME||process.cwd();
  return resolve(base,'nhunnhun-queue-cache','nutrition-sources.json');
}
async function readNutritionCache(){
  if(nutritionMemory.size)return nutritionMemory;
  try{
    const parsed=JSON.parse(await readFile(nutritionCachePath(),'utf8'));
    if(parsed?.version===NUTRITION_CACHE_VERSION)for(const [key,value] of Object.entries(parsed.entries??{}))if(value?.source?.id)nutritionMemory.set(key,value);
  }catch{}
  return nutritionMemory;
}
async function writeNutritionCache(){
  const path=nutritionCachePath();
  try{
    await mkdir(resolve(path,'..'),{recursive:true});
    await writeFile(path,JSON.stringify({version:NUTRITION_CACHE_VERSION,updatedAt:new Date().toISOString(),entries:Object.fromEntries(nutritionMemory)},null,2)+'\n');
  }catch{}
}
const nutritionCacheKey=query=>String(query).trim().toLowerCase();

export async function usdaNutritionSource(query,fetcher,{apiKey=process.env.USDA_API_KEY||'DEMO_KEY',useCache=true}={}){
  const key=nutritionCacheKey(query);
  if(useCache){
    const cache=await readNutritionCache(),cached=cache.get(key);
    if(cached?.source)return {...cached,status:'cache-hit'};
  }
  const isDemo=apiKey==='DEMO_KEY';
  if(isDemo&&(Date.now()<demoUsdaCircuitOpenUntil||demoUsdaCalls>=DEMO_USDA_SAFE_CALLS)){
    return {source:null,status:'demo-budget-exhausted',provider:'usda'};
  }
  const url=new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key',apiKey);
  url.searchParams.set('query',query);
  url.searchParams.set('pageSize','8');
  if(isDemo)demoUsdaCalls++;
  let response;
  try{response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000)});}
  catch{return {source:null,status:'transport-error',provider:'usda'};}
  if(response?.status===429){
    if(isDemo)demoUsdaCircuitOpenUntil=Date.now()+65*60*1000;
    return {source:null,status:'rate-limited',provider:'usda'};
  }
  if(!response?.ok)return {source:null,status:`http-${response?.status??'unknown'}`,provider:'usda'};
  let data;try{data=await response.json();}catch{return {source:null,status:'invalid-json',provider:'usda'};}
  const foods=Array.isArray(data?.foods)?data.foods:[];
  const terms=topicTerms(query);
  const food=foods.find(x=>{
    const text=`${x?.description??''} ${x?.additionalDescriptions??''}`.toLowerCase();
    return terms.length?terms.some(term=>text.includes(term)):true;
  })||foods[0];
  if(!food?.fdcId||!food?.description)return {source:null,status:'not-found',provider:'usda'};
  const nutrients=(food.foodNutrients??[]).filter(n=>Number.isFinite(Number(n?.value))&&n?.nutrientName&&n?.unitName).slice(0,40);
  const notes=[
    `USDA FoodData Central food: ${food.description}.`,
    'FoodData Central nutrient amounts are expressed per 100 g of food for the database nutrient record. These values are composition data, not a recommended intake.',
    ...nutrients.map(n=>`${n.nutrientName}: ${n.value} ${n.unitName}`)
  ].join(' ');
  const source={
    id:`usda-fdc-${food.fdcId}`,
    title:`USDA FoodData Central — ${food.description}`,
    url:`https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
    checkedAt:todayInSeoul(),
    notes:notes.slice(0,6000),
    kind:'nutrition-database',
    role:'nutrition',
    scopeNote:'USDA FoodData Central 식품 영양자료다. 영양소 amount는 식품 100 g 기준으로 해석하며 권장 섭취량으로 확대하지 않는다.'
  };
  const entry={source,provider:'usda',status:'ok',cachedAt:new Date().toISOString()};
  if(useCache){nutritionMemory.set(key,entry);await writeNutritionCache();}
  return entry;
}

async function englishQuery(item,{model,fetcher}){
  const curated=CURATED_QUEUE_QUERIES[item.keyword];if(curated)return curated;
  const verified=VERIFIED_ALIASES[item.keyword];if(verified?.englishQuery)return verified.englishQuery;
  const cache=await readQueryCache(),key=queryCacheKey(item),cached=cache.get(key);
  if(cached)return cached;
  const schema={type:'object',additionalProperties:false,required:['englishQuery'],properties:{englishQuery:{type:'string',minLength:2,maxLength:120}}};
  const out=await ollamaJson([{role:'system',content:'입력은 검색 대상이다. PubMed와 공식 자료에서 이 식품·영양소·약·질병 자체를 찾기 위한 핵심 영문명만 JSON으로 반환한다. 효능·검색 연산자를 추가하지 않는다.'},{role:'user',content:JSON.stringify({keyword:item.keyword,domain:item.domain})}],schema,{model,fetcher,numPredict:120});
  if(!/^[A-Za-z0-9 ()'.,-]+$/.test(out.englishQuery))throw new Error('E_QUEUE_ENGLISH_QUERY');
  const value=out.englishQuery.trim();
  cache.set(key,value);await writeQueryCache();
  return value;
}
function topicTerms(query){
  const stop=new Set(['acid','food','foods','plant','plants','extract','extracts']);
  return String(query).toLowerCase().split(/[^a-z0-9]+/).filter(term=>term.length>=4&&!stop.has(term));
}
export function isTopicSpecificSource(source,query){
  const terms=topicTerms(query);if(!terms.length)return false;
  const haystack=`${source?.title??''} ${source?.notes??''}`.toLowerCase();
  return terms.some(term=>haystack.includes(term));
}
export function classifyEvidenceSufficiency(item,sources,nutrition=null){
  const strong=(sources??[]).filter(s=>['official','guideline','systematic-review','trial','nutrition-database'].includes(s.kind)&&['health','safety','nutrition','authorization'].includes(s.role));
  const direct=(sources??[]).filter(s=>s.topicSpecific===true&&(s.role==='health'||s.role==='nutrition'||s.role==='authorization'));
  // Food/nutrient articles may proceed conservatively with one direct source; medicine/disease retain strict source gates.
  if(item?.domain==='food'&&!nutrition&&!direct.length)throw new Error('E_QUEUE_RESEARCH_TOPIC_SPECIFIC');
  if(item?.domain==='nutrient'&&!direct.length)throw new Error('E_QUEUE_RESEARCH_TOPIC_SPECIFIC');
  if(item?.domain==='medicine'&&!(sources??[]).some(s=>s.kind==='official'&&s.role==='authorization'))throw new Error('E_QUEUE_KR_AUTHORIZATION_MISSING');
  if(item?.domain==='disease'&&!(sources??[]).some(s=>['official','guideline'].includes(s.kind)&&s.role==='health'))throw new Error('E_QUEUE_DISEASE_PRIMARY_SOURCE');
  return {directCount:direct.length,strongCount:strong.length,claimMode:strong.length>=2?'full':'conservative'};
}

export async function collectEvidence(item,publicHtml,{model,fetcher=fetch}={}){
  const query=await englishQuery(item,{model,fetcher});
  const external=externalLinks(publicHtml);
  const fixed=item.domain==='food'?[
    ['https://www.nhs.uk/healthier-families/food-facts/5-a-day/','health'],
    ['https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-produce-safely','safety']
  ]:[];
  const pubmedPromise=item.domain==='food'
    ?Promise.all([
      research(query+' nutrition',fetcher,{retmax:4,sort:'relevance',minResults:1}).catch(()=>[]),
      research(query+' health',fetcher,{retmax:4,sort:'relevance',minResults:1}).catch(()=>[])
    ]).then(groups=>{
      const seen=new Set(),out=[];
      for(const source of groups.flat())if(!seen.has(source.id)){seen.add(source.id);out.push(source);}
      return out.slice(0,5);
    })
    :research(query,fetcher,{retmax:5,sort:'pub date',minResults:1}).catch(()=>[]);
  const externalPromise=Promise.all(external.map((url,i)=>fetchSource(url,item.domain,i+1,fetcher)));
  const fixedPromise=Promise.all(fixed.map(async([url,role],i)=>{
    const source=await fetchSource(url,item.domain,external.length+i+1,fetcher);
    return source?{...source,kind:'official',role,scopeNote:'일반 식단·신선 식품 안전 안내이며 이 개별 식품의 질병 치료·임상 효과·전용 섭취량 근거가 아니다.'}:null;
  }));
  const nutritionPromise=item.domain==='food'?usdaNutritionSource(query,fetcher):Promise.resolve({source:null,status:'not-applicable',provider:null});

  const [pubmed,webFetched,fixedFetched,nutritionResult]=await Promise.all([pubmedPromise,externalPromise,fixedPromise,nutritionPromise]);
  const nutrition=nutritionResult?.source??null;
  const web=webFetched.filter(Boolean),official=fixedFetched.filter(Boolean);
  const map=new Map();
  const ordered=[...(nutrition?[nutrition]:[]),...official,...web,...pubmed.map(s=>({...s,scopeNote:'PubMed 색인 초록을 실제 조회해 연구 대상·기간·결과의 적용 범위를 확인한다. 초록만으로 확인되지 않는 내용은 확정하지 않는다.'}))];
  for(const s of ordered)if(!map.has(s.url))map.set(s.url,s);
  const sources=[...map.values()].slice(0,10).map(s=>({...s,topicSpecific:isTopicSpecificSource(s,query)}));
  const evidenceProfile=classifyEvidenceSufficiency(item,sources,nutrition);
  return {
    query,sources,evidenceProfile,
    nutrition:{available:!!nutrition,status:nutritionResult?.status??'unknown',provider:nutritionResult?.provider??null}
  };
}

export const DOMAIN_EXTENSION_ALLOW=Object.freeze({
  food:new Set(['longTerm','comparison','combinations','products','cultivars','origins','seasonality','cost','folkRemedies','exercise','diet','vulnerableGroups','myths','latest']),
  nutrient:new Set(['longTerm','comparison','combinations','products','foodReplacement','essentialNutrient','origins','cost','exercise','diet','vulnerableGroups','discontinuation','missedDose','myths','latest']),
  medicine:new Set(['longTerm','comparison','combinations','products','cost','folkRemedies','diet','vulnerableGroups','discontinuation','missedDose','myths','latest']),
  disease:new Set(['longTerm','comparison','folkRemedies','selfCheck','exercise','diet','vulnerableGroups','myths','latest']),
});
function extensionSchema(sources){
  const sourceIds=sources.map(s=>s.id),properties={};
  for(const key of Object.keys(EXTENSIONS))properties[key]={type:'object',additionalProperties:false,required:['applies','reason','sourceIds'],properties:{
    applies:{type:'boolean'},reason:{type:'string',minLength:12,maxLength:240},
    sourceIds:{type:'array',maxItems:4,items:{type:'string',enum:sourceIds}}
  }};
  return {type:'object',additionalProperties:false,required:Object.keys(EXTENSIONS),properties};
}
function identityDrift(item,result,evidence){
  const text=JSON.stringify(result);
  if(item.keyword==='가지'&&/(bok\s*choy|chinese\s*cabbage|청경채|배추)/iu.test(text)){
    throw Object.assign(new Error('E_QUEUE_IDENTITY_DRIFT'),{details:{keyword:item.keyword,canonicalQuery:evidence.query}});
  }
}
export function normalizeExtensionDecisions(item,evidence,result){
  identityDrift(item,result,evidence);
  const allowed=DOMAIN_EXTENSION_ALLOW[item.domain]??new Set();
  const sourceById=new Map(evidence.sources.map(s=>[s.id,s]));
  const topicSpecificIds=new Set(evidence.sources.filter(s=>s.topicSpecific).map(s=>s.id));
  const out={};
  for(const key of Object.keys(EXTENSIONS)){
    const entry=result[key]??{applies:false,reason:'근거가 없어 적용하지 않는다.',sourceIds:[]};
    const validIds=[...new Set((entry.sourceIds??[]).filter(id=>sourceById.has(id)))];
    if(!allowed.has(key)){
      out[key]={applies:false,reason:`${item.domain} 분야에서 이 확장 질문은 이번 글의 직접 범위가 아니므로 적용하지 않는다.`};
      continue;
    }
    if(entry.applies&&!validIds.some(id=>topicSpecificIds.has(id))){
      out[key]={applies:false,reason:`${item.keyword} 자체를 직접 다루는 주제 특이 근거가 없어 이번 글에서는 이 확장 질문을 적용하지 않는다.`};
      continue;
    }
    out[key]={applies:entry.applies===true,reason:entry.reason};
  }
  // Known-topic profiles are review suggestions, never evidence or forced coverage.
  return out;
}
export async function decideExtensions(item,evidence,{model,fetcher=fetch}={}){
  const recommended=TOPIC_EXTENSIONS[TOPIC_ENTITIES[normTopic(item.keyword)]]||[];
  const canonical=`${item.keyword} = ${evidence.query}`;
  const result=await ollamaJson([
    {role:'system',content:'건강정보 편집자다. canonicalSubject는 확정된 대상이며 다른 식품·성분·질병으로 재해석하지 않는다. 확장 질문은 독자의 현재 질문에 필요하고 실제 자료로 답할 수 있을 때만 true다. recommended는 검토할 후보이며 필수가 아니다. 근거 부족·범위 밖인 항목은 구체적 이유와 함께 false로 두고 다른 내용을 계속 작성한다. 일반 식단 자료를 개별 식품의 효능·용량으로 확대하지 않는다. 주제 이름이 등장하는 논문이라도 농업·유전학 연구를 사람의 건강 효과 근거로 쓰지 않는다. true인 항목은 실제 근거 sourceIds를 넣는다. 이유는 한국어로 쓴다.'},
    {role:'user',content:JSON.stringify({canonicalSubject:canonical,keyword:item.keyword,canonicalEnglishQuery:evidence.query,domain:item.domain,recommended,extensions:EXTENSIONS,sources:evidence.sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,topicSpecific:s.topicSpecific,scopeNote:s.scopeNote,notes:s.notes.slice(0,2200)}))})}
  ],extensionSchema(evidence.sources),{model,fetcher,numPredict:5000});
  return normalizeExtensionDecisions(item,evidence,result);
}
