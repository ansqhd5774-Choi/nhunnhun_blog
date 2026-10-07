import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ollamaJson } from './queue-ollama.mjs';

const BLOG='https://nhunnhun.tistory.com';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export const SIMPLE_CONTENT_SPECS=Object.freeze({
  food:[
    {id:'food-1',heading:'음식(식품) 소개',targetChars:260,modules:['identity']},
    {id:'food-2',heading:'영양소와 핵심 성분',targetChars:320,modules:['nutrition','benefits']},
    {id:'food-3',heading:'꾸준히 섭취시 신체 변화',targetChars:300,modules:['benefits','amount']},
    {id:'food-4',heading:'궁합이 잘맞는 음식과 시너지 효과',targetChars:230,modules:[]},
    {id:'food-5',heading:'섭취시 주의사항',targetChars:230,modules:['safety']},
    {id:'food-6',heading:'좋은 제품을 고르는 방법',targetChars:160,modules:['selection','preparation','storage','decision']},
  ],
  nutrient:[
    {id:'nutrient-1',heading:'정의와 주요 성분 및 작용',targetChars:250,modules:['identity','role']},
    {id:'nutrient-2',heading:'한 달 섭취 후 기대되는 신체 변화와 권장 대상',targetChars:260,modules:['benefits','audience','expectations']},
    {id:'nutrient-3',heading:'일일 권장 섭취량(최소~최대)과 권장 섭취 방법',targetChars:240,modules:['amount','use']},
    {id:'nutrient-4',heading:'풍부한 식품 TOP7과 각 식품의 평균 함유량',targetChars:300,modules:[]},
    {id:'nutrient-5',heading:'함께 섭취하면 좋은 영양소 5가지와 시너지·상호작용',targetChars:230,modules:['interactions']},
    {id:'nutrient-6',heading:'결핍·과다 섭취 위험, 예방 가능한 질병, 추천 영양제·브랜드',targetChars:220,modules:['safety','selection','decision']},
  ],
  medicine:[
    {id:'medicine-1',heading:'약의 개발 목적과 주요 성분 및 작용',targetChars:260,modules:['identity']},
    {id:'medicine-2',heading:'치료 가능한 주요 적응증과 근거 수준',targetChars:300,modules:['indications','audience']},
    {id:'medicine-3',heading:'복용 시 효과를 높이는 영양소·보조제 TOP5와 근거',targetChars:260,modules:['timeline']},
    {id:'medicine-4',heading:'함께 복용하면 금기이거나 상호작용을 일으키는 약물·식품',targetChars:230,modules:['interactions','contraindications']},
    {id:'medicine-5',heading:'주의 대상, 알려진 부작용·과다복용 위험 및 모니터링 기준',targetChars:270,modules:['safety','medical_help']},
    {id:'medicine-6',heading:'부작용을 최소화하는 실전 복용법과 대체 가능한 약품 비교',targetChars:180,modules:['amount','use','storage','decision']},
  ],
  disease:[
    {id:'disease-1',heading:'질환의 정의와 병태생리·발생 메커니즘',targetChars:260,modules:['identity','symptoms']},
    {id:'disease-2',heading:'주요 원인·위험인자와 고위험군',targetChars:240,modules:['causes','risk']},
    {id:'disease-3',heading:'진단 기준과 필수 검사 및 감별진단',targetChars:300,modules:['self_check','diagnosis']},
    {id:'disease-4',heading:'예방 방법과 도움이 되는 음식 TOP5·섭취 패턴',targetChars:230,modules:['home_care']},
    {id:'disease-5',heading:'표준 치료와 권장 의약품 TOP3·근거 수준',targetChars:320,modules:['treatment','medical_help']},
    {id:'disease-6',heading:'재발 예방 생활습관, 치료 후 부작용, 추적관찰·모니터링',targetChars:150,modules:['red_flags','decision']},
  ],
});

const TERM_ALIASES=Object.freeze({
  '비타민 C':['vitamin c','ascorbic acid','비타민 c','비타민c'],
  '비타민 A':['vitamin a','retinol','비타민 a','비타민a'],
  '베타카로틴':['beta carotene','β-carotene','베타카로틴'],
  '식이섬유':['dietary fiber','fiber','식이섬유'],
  '칼륨':['potassium','칼륨'],
  '철분':['iron','철분'],
  '마그네슘':['magnesium','마그네슘'],
  '아연':['zinc','아연'],
  '오메가3':['omega-3','omega 3','epa','dha','오메가3'],
  '카페인':['caffeine','카페인'],
  '리코펜':['lycopene','리코펜'],
  '루테인':['lutein','루테인'],
  '지아잔틴':['zeaxanthin','지아잔틴'],
});

async function jsonIfExists(path){
  try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
async function files(root,dir){
  try{return (await readdir(resolve(root,dir))).filter(name=>name.endsWith('.json'));}catch(error){if(error?.code==='ENOENT')return [];throw error;}
}

async function publishedCatalog(root){
  const out=[];
  for(const name of await files(root,'publishing/state')){
    const state=await jsonIfExists(resolve(root,'publishing/state',name));
    if(state?.phase!=='published'||!/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(state.url??''))continue;
    const source=await jsonIfExists(resolve(root,'posts',name));
    if(source?.title)out.push({title:source.title,url:state.url,term:source.title.split(/[·｜|:—-]/)[0].trim()});
  }
  for(const name of await files(root,'publishing/update-state')){
    const state=await jsonIfExists(resolve(root,'publishing/update-state',name));
    if(state?.phase!=='updated'||!state.title||!/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(state.url??''))continue;
    out.push({title:state.title,url:state.url,term:state.title.split(/[·｜|:—-]/)[0].trim()});
  }
  const seen=new Set();
  return out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;});
}

function relevantTerms(item,evidence,currentHtml=''){
  const haystack=(JSON.stringify(evidence??{})+' '+currentHtml).toLowerCase();
  const terms=[];
  for(const [term,aliases] of Object.entries(TERM_ALIASES)){
    if(aliases.some(alias=>haystack.includes(alias.toLowerCase())))terms.push(term);
  }
  return [...new Set(terms)].filter(term=>term!==item.keyword).slice(0,8);
}

function stripTags(value=''){return String(value).replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();}
async function searchPublicBlog(term,fetcher){
  try{
    const response=await fetcher(`${BLOG}/search/${encodeURIComponent(term)}`,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)return [];
    const html=await response.text(),out=[];
    for(const m of html.matchAll(/<a\b[^>]*href=["'](https:\/\/nhunnhun\.tistory\.com\/(\d+))["'][^>]*>([\s\S]*?)<\/a>/gi)){
      const title=stripTags(m[3]);if(title)out.push({term,title,url:m[1]});
    }
    return out;
  }catch{return [];}
}

export async function discoverInternalLinks(root,item,evidence,currentHtml='',{fetcher=fetch,max=6}={}){
  const catalog=await publishedCatalog(root),terms=relevantTerms(item,evidence,currentHtml),out=[],seen=new Set([item.targetUrl]);
  for(const term of terms){
    const local=catalog.filter(x=>x.title.includes(term)||x.term===term).slice(0,2);
    const candidates=local.length?local:await searchPublicBlog(term,fetcher);
    for(const x of candidates){
      if(seen.has(x.url))continue;seen.add(x.url);out.push({term,title:x.title,url:x.url});
      if(out.length>=max)return out;
      break;
    }
  }
  return out;
}

function writerSchema(specs){
  return {type:'object',additionalProperties:false,required:['title','lead','summary','sections'],properties:{
    title:{type:'string',minLength:8,maxLength:150},
    lead:{type:'string',minLength:40,maxLength:500},
    summary:{type:'string',minLength:30,maxLength:450},
    sections:{type:'array',minItems:specs.length,maxItems:specs.length,items:{type:'object',additionalProperties:false,required:['id','heading','paragraphs'],properties:{
      id:{type:'string',enum:specs.map(s=>s.id)},
      heading:{type:'string',minLength:4,maxLength:100},
      paragraphs:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:30,maxLength:700}}
    }}}
  }};
}

function sourcePack(evidence){
  return (evidence?.sources??[]).map(s=>({id:s.id,title:s.title,url:s.url,kind:s.kind,role:s.role,notes:String(s.notes??'').slice(0,2200)}));
}

export async function writeSimpleArticle(item,evidence,currentTitle,internalLinks,{model,fetcher=fetch}={}){
  const specs=SIMPLE_CONTENT_SPECS[item.domain];
  if(!specs)throw new Error('E_QUEUE_SIMPLE_DOMAIN');
  const system='한국어 건강정보 블로그 글을 작성한다. 제공된 자료를 활용해 아래 지정 주제들을 충분히 설명한다. 각 항목의 목표 글자수는 정보량 기준이다. 표현은 흥미를 끌 수 있도록 강하고 인상적으로 작성하되 사실·수치·효능 자체는 과장하지 않는다. 관련 내부링크는 제공된 목록만 사용하고 URL을 새로 만들지 않는다. 독자가 바로 이해할 수 있는 자연스러운 문체로 쓴다. JSON만 출력한다.';
  const user={keyword:item.keyword,domain:item.domain,currentTitle,sections:specs.map(({id,heading,targetChars})=>({id,heading,targetChars})),sources:sourcePack(evidence),internalLinks};
  const draft=await ollamaJson([{role:'system',content:system},{role:'user',content:JSON.stringify(user)}],writerSchema(specs),{model,fetcher,numPredict:6500,numCtx:12288});
  const byId=new Map(draft.sections.map(s=>[s.id,s]));
  const sourceIds=(evidence?.sources??[]).slice(0,6).map(s=>s.id);
  const sections=specs.map(spec=>{
    const written=byId.get(spec.id);if(!written)throw new Error('E_QUEUE_SIMPLE_SECTION');
    const first=String(written.paragraphs?.[0]??'').trim();
    return {...written,heading:written.heading||spec.heading,modules:[...spec.modules],sourceIds,strongPhrase:first.slice(0,Math.min(70,first.length)),claims:[]};
  });
  return {title:draft.title,lead:draft.lead,summary:draft.summary,plan:{scope:'simple',primaryQuestion:`${item.keyword}에 대해 필요한 핵심 정보를 확인한다.`,readerSituation:`${item.keyword} 정보를 찾는 일반 독자`,nextActions:[`${item.keyword}의 핵심 정보를 실제 선택과 섭취에 활용한다.`]},sections,claims:[]};
}

function linkify(text,links,used){
  let out=esc(text);
  for(const link of links){
    if(used.has(link.url))continue;
    const term=esc(link.term);
    if(term&&out.includes(term)){
      out=out.replace(term,`<a href="${esc(link.url)}"><strong>${term}</strong></a>`);
      used.add(link.url);
    }
  }
  return out;
}

function attribution(images){
  return images.map((x,i)=>`<li><a href="${esc(x.sourcePage)}">이미지 ${i+1} 원출처</a> — ${esc(x.author)}, ${esc(x.license)}</li>`).join('');
}

export function renderSimpleBody(article,evidence,images,internalLinks=[]){
  const imageTags=images.map(x=>`<p><img src="${esc(x.src)}" alt="${esc(x.alt)}"></p>`);
  const used=new Set();
  let html=imageTags[0]+`\n<p>${linkify(article.lead,internalLinks,used)}</p>\n<blockquote><strong>핵심만 먼저:</strong> ${linkify(article.summary,internalLinks,used)}</blockquote>`;
  const p1=Math.max(1,Math.floor(article.sections.length/3)),p2=Math.max(p1+1,Math.floor(article.sections.length*2/3));
  article.sections.forEach((section,index)=>{
    html+=`\n<h2>${esc(section.heading)}</h2>`;
    for(const p of section.paragraphs)html+=`\n<p>${linkify(p,internalLinks,used)}</p>`;
    if(index===p1-1)html+=`\n${imageTags[1]}`;
    if(index===p2-1)html+=`\n${imageTags[2]}`;
  });
  html+=`\n<h2>핵심 정리</h2><ul>${article.sections.map(s=>`<li>${esc(s.strongPhrase)}</li>`).join('')}</ul>`;
  const related=internalLinks.filter(x=>used.has(x.url)).slice(0,3);
  if(related.length)html+=`\n<h2>함께 보면 좋은 글</h2>${related.map(x=>`<p><a href="${esc(x.url)}"><strong>${esc(x.title)}</strong></a></p>`).join('')}`;
  html+=`\n<h2>자료 출처</h2><ul>${(evidence?.sources??[]).map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a> — 자료 확인일 ${esc(s.checkedAt)}</li>`).join('')}${attribution(images)}</ul>`;
  return {html,glossary:[]};
}
