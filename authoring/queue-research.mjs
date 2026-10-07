import sanitizeHtml from 'sanitize-html';
import {parseDocument} from 'htmlparser2';
import { research, VERIFIED_ALIASES } from './keywords.mjs';
import { ollamaJson } from './queue-ollama.mjs';
import { todayInSeoul } from '../publishing/content-standards.mjs';
import { EXTENSIONS, TOPIC_ENTITIES, TOPIC_EXTENSIONS, normTopic } from '../publishing/standards/common.mjs';

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
async function englishQuery(item,{model,fetcher}){
  const verified=VERIFIED_ALIASES[item.keyword];if(verified?.englishQuery)return verified.englishQuery;
  const schema={type:'object',additionalProperties:false,required:['englishQuery'],properties:{englishQuery:{type:'string',minLength:2,maxLength:120}}};
  const out=await ollamaJson([{role:'system',content:'입력은 검색 대상이다. PubMed에서 이 식품·영양소·약·질병 자체를 찾기 위한 핵심 영문명만 JSON으로 반환한다. 효능·검색 연산자를 추가하지 않는다.'},{role:'user',content:JSON.stringify({keyword:item.keyword,domain:item.domain})}],schema,{model,fetcher,numPredict:300});
  if(!/^[A-Za-z0-9 ()'.,-]+$/.test(out.englishQuery))throw new Error('E_QUEUE_ENGLISH_QUERY');
  return out.englishQuery.trim();
}
export async function collectEvidence(item,publicHtml,{model,fetcher=fetch}={}){
  const query=await englishQuery(item,{model,fetcher});
  let pubmed=[];try{pubmed=await research(query,fetcher,{retmax:5,sort:'pub date'});}catch{}
  const web=[];let index=0;
  for(const url of externalLinks(publicHtml)){const source=await fetchSource(url,item.domain,++index,fetcher);if(source)web.push(source);}
  if(item.domain==='food') {
    for(const [url,role] of [['https://www.nhs.uk/healthier-families/food-facts/5-a-day/','health'],['https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-produce-safely','safety']]) {
      const source=await fetchSource(url,item.domain,++index,fetcher);
      if(source) web.unshift({...source,kind:'official',role,scopeNote:'일반 채소 식단·신선 식품 안전 안내이며 이 개별 식품의 질병 치료·임상 효과·전용 섭취량 근거가 아니다.'});
    }
  }
  const map=new Map();
  for(const s of [...web,...pubmed.map(s=>({...s,scopeNote:'PubMed 색인 초록을 실제 조회해 연구 대상·기간·결과의 적용 범위를 확인한다. 초록만으로 확인되지 않는 내용은 확정하지 않는다.'}))])if(!map.has(s.url))map.set(s.url,s);
  const sources=[...map.values()].slice(0,10);
  const high=sources.filter(s=>['official','guideline','systematic-review','trial','nutrition-database'].includes(s.kind)&&['health','safety','nutrition','authorization'].includes(s.role));
  if(high.length<2)throw new Error('E_QUEUE_RESEARCH_HIGH_QUALITY');
  if(item.domain==='medicine'&&!sources.some(s=>s.kind==='official'&&s.role==='authorization'))throw new Error('E_QUEUE_KR_AUTHORIZATION_MISSING');
  if(item.domain==='disease'&&!sources.some(s=>['official','guideline'].includes(s.kind)))throw new Error('E_QUEUE_DISEASE_PRIMARY_SOURCE');
  return {query,sources};
}
function extensionSchema(){
  const properties={};
  for(const key of Object.keys(EXTENSIONS))properties[key]={type:'object',additionalProperties:false,required:['applies','reason'],properties:{applies:{type:'boolean'},reason:{type:'string',minLength:12,maxLength:240}}};
  return {type:'object',additionalProperties:false,required:Object.keys(EXTENSIONS),properties};
}
export async function decideExtensions(item,evidence,{model,fetcher=fetch}={}){
  const forced=TOPIC_EXTENSIONS[TOPIC_ENTITIES[normTopic(item.keyword)]]||[];
  const result=await ollamaJson([{role:'system',content:'건강정보 편집자다. 각 확장 질문이 독자의 검색의도와 제공 근거에서 실제로 필요한지 판단한다. 근거가 부족하면 false다. 모든 항목에 구체적 이유를 적는다. forced는 반드시 true다.'},{role:'user',content:JSON.stringify({keyword:item.keyword,domain:item.domain,forced,extensions:EXTENSIONS,sources:evidence.sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,notes:s.notes.slice(0,2200)}))})}],extensionSchema(),{model,fetcher,numPredict:5000});
  for(const key of forced)result[key]={applies:true,reason:`현재 R1의 ${item.keyword} 주제 프로필에서 필수로 검토하도록 지정된 확장 질문이므로 실제 근거 범위 안에서 포함한다.`};
  return result;
}
