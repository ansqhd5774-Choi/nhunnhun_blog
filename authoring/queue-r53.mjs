import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ollamaJson } from './queue-ollama.mjs';
import { glossaryPass } from './queue-draft.mjs';
import { fetchSource, isTopicSpecificSource } from './queue-research.mjs';
import { renderFoodMarkdown } from './queue-food-sections.mjs';
import { applyFoodDesign } from './food-design.mjs';

const BLOG='https://nhunnhun.tistory.com';

export const R53_SECTION_SPECS=Object.freeze({
  food:[
    {id:'s1',heading:'음식(식품) 소개',targetChars:260,modules:['identity']},
    {id:'s2',heading:'영양소와 핵심 성분',targetChars:320,modules:['nutrition']},
    {id:'s3',heading:'꾸준히 섭취시 신체 변화',targetChars:300,modules:['benefits']},
    {id:'s4',heading:'궁합이 잘맞는 음식과 시너지 효과',targetChars:230,modules:['combinations']},
    {id:'s5',heading:'섭취시 주의사항',targetChars:230,modules:['safety']},
    {id:'s6',heading:'좋은 제품을 고르는 방법',targetChars:160,modules:['selection']},
  ],
  nutrient:[
    {id:'s1',heading:'정의·주요 효능(Best 5)은 무엇인가?',targetChars:250,modules:['benefits']},
    {id:'s2',heading:'한 달 섭취 시 예상되는 신체 변화와 섭취가 특히 필요한 대상은 누구인가?',targetChars:260,modules:['long_term']},
    {id:'s3',heading:'일일 권장 섭취량(최소~최대)과 권장 섭취 방법은 무엇인가?',targetChars:240,modules:['amount']},
    {id:'s4',heading:'풍부 식품 TOP7과 각 식품의 평균 함유량은 얼마인가?',targetChars:300,modules:['food_sources']},
    {id:'s5',heading:'함께 섭취하면 좋은 영양소 5가지와 시너지, 음식·약물 상호작용은 무엇인가?',targetChars:230,modules:['combinations']},
    {id:'s6',heading:'결핍 증상·과다 섭취 부작용·예방 가능한 질병·추천 영양제·브랜드는 무엇인가?',targetChars:220,modules:['deficiency']},
  ],
  medicine:[
    {id:'s1',heading:'개발 목적과 주요 성분의 작용은 무엇인가?',targetChars:260,modules:['identity']},
    {id:'s2',heading:'치료 가능한 주요 적응증과 근거 수준은 무엇인가?',targetChars:300,modules:['indications']},
    {id:'s3',heading:'복용 시 효과를 높이는 영양소·보조제 TOP5와 근거는 무엇인가?',targetChars:260,modules:['combinations']},
    {id:'s4',heading:'함께 복용하면 금기이거나 상호작용을 일으키는 약물·식품과 위험 수준은 무엇인가?',targetChars:230,modules:['interactions']},
    {id:'s5',heading:'주의 대상, 알려진 부작용·과다복용 위험 및 모니터링 기준은 무엇인가?',targetChars:270,modules:['safety']},
    {id:'s6',heading:'부작용을 최소화하는 실전 복용법과 대체 가능한 약품은 무엇인가?',targetChars:180,modules:['alternatives']},
  ],
  disease:[
    {id:'s1',heading:'이 질환의 정의와 병태생리는 무엇인가?',targetChars:260,modules:['identity']},
    {id:'s2',heading:'주요 원인·위험인자와 고위험군은 누구인가?',targetChars:240,modules:['risk']},
    {id:'s3',heading:'진단 기준과 필수 검사 및 감별진단은 무엇인가?',targetChars:300,modules:['diagnosis']},
    {id:'s4',heading:'예방 방법과 도움이 되는 음식 TOP5·섭취 패턴은 무엇인가?',targetChars:230,modules:['diet']},
    {id:'s5',heading:'표준 치료와 권장 의약품 TOP3·용량·기간 근거는 무엇인가?',targetChars:320,modules:['treatment']},
    {id:'s6',heading:'재발 예방 생활습관·치료 후 부작용·추적관찰은 어떻게 하나?',targetChars:150,modules:['follow_up']},
  ],
});

export const R53_REQUIRED_MODULES=Object.freeze(Object.fromEntries(
  Object.entries(R53_SECTION_SPECS).map(([domain,sections])=>[domain,sections.flatMap(section=>section.modules)])
));

const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const norm=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim();
const plain=html=>norm(String(html??'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));

function unsuitableFoodEvidence(source){
  const text=(String(source?.title??'')+' '+String(source?.notes??'')).toLowerCase();
  return /(insecticide|pesticide|whitefly|aphid|yield response|field conditions|crop|crispr|genome|genomic|gene expression|salt stress|breeding|cultivar|agronom|dissipation|residue)/i.test(text);
}

function writerSources(item,evidence){
  const sources=[...(evidence?.sources??[])];
  if(item?.domain!=='food')return sources;
  return sources.filter(source=>!unsuitableFoodEvidence(source));
}

async function readCuratedEvidence(root,item){
  try{
    const path=resolve(root,'authoring/curated-evidence',String(item.articleId)+'.json');
    const data=JSON.parse(await readFile(path,'utf8'));
    if(String(data.articleId)!==String(item.articleId)||data.keyword!==item.keyword)return null;
    return data;
  }catch(error){if(error?.code==='ENOENT')return null;throw error;}
}

export async function applyCuratedEvidence(root,item,evidence,{fetcher=fetch,cached=(_stage,_input,action)=>action(),onCacheHit}={}){
  const curated=await readCuratedEvidence(root,item);
  if(!curated)return {...evidence,r53SectionEvidence:null,r53InternalLinks:[]};
  const existing=new Map((evidence?.sources??[]).map(source=>[source.id,source]));
  const retrieved=await cached('curated',{sources:curated.sources,day:new Date().toISOString().slice(0,10)},
    ()=>Promise.all((curated.sources??[]).map(async(source,index)=>{
      const existingSource=(evidence.sources??[]).find(s=>s.url===source.url&&s.notes);
      return existingSource??await fetchSource(source.url,item.domain,index+1,fetcher);
    })),onCacheHit);
  for(const [index,source] of (curated.sources??[]).entries()){
    const original=retrieved[index];
    if(!original?.notes)continue;
    existing.set(source.id,{
      ...source,
      checkedAt:original.checkedAt,
      topicSpecific:isTopicSpecificSource(original,evidence.query),
      scopeNote:'해당 URL에서 실제 조회한 본문 발췌다. 편집자가 정리한 절별 사실을 원문 인용으로 바꾸지 않는다.',
      notes:original.notes,evidenceOrigin:'public-fetch'
    });
  }
  return {
    ...evidence,
    sources:[...existing.values()],
    // Section summaries are planning hints, never substituted for source excerpts.
    r53SectionEvidence:curated.sections??null,
    r53InternalLinks:Array.isArray(curated.internalLinks)?curated.internalLinks:[]
  };
}

function writerSchema(specs){
  return {
    type:'object',additionalProperties:false,
    required:['title','lead','summary','sections'],
    properties:{
      title:{type:'string',minLength:8,maxLength:140},
      lead:{type:'string',minLength:40,maxLength:420},
      summary:{type:'string',minLength:30,maxLength:320},
      sections:{
        type:'array',minItems:specs.length,maxItems:specs.length,
        items:{
          type:'object',additionalProperties:false,
          required:['id','paragraphs'],
          properties:{
            id:{type:'string',enum:specs.map(x=>x.id)},
            paragraphs:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:30,maxLength:700}}
          }
        }
      }
    }
  };
}

async function jsonFiles(root,dir){
  try{return (await readdir(resolve(root,dir))).filter(n=>n.endsWith('.json')).sort();}catch(error){if(error?.code==='ENOENT')return [];throw error;}
}

function existingInternalLinks(html,item){
  const out=[];
  for(const match of String(html??'').matchAll(/<a\b[^>]*href=(["'])(https:\/\/nhunnhun\.tistory\.com\/(\d+))\1[^>]*>([\s\S]*?)<\/a>/gi)){
    if(match[3]===String(item.articleId))continue;
    const label=plain(match[4]);
    if(label)out.push({label,url:match[2],source:'existing'});
  }
  return out;
}

async function catalogLinks(root,item,haystack){
  const out=[];
  try{
    const queue=await readFile(resolve(root,'authoring/update-queue.txt'),'utf8');
    for(const row of queue.split(/\r?\n/)){
      const m=row.trim().match(/^(음식|영양소|약|질병)\s+-\s+(.+?)\s+-\s+(https:\/\/nhunnhun\.tistory\.com\/(\d+))$/u);
      if(!m||m[4]===String(item.articleId))continue;
      const keyword=m[2].trim();
      if(keyword.length>=2&&haystack.includes(keyword))out.push({label:keyword,url:m[3],source:'queue'});
    }
  }catch{}
  for(const dir of ['posts','updates','authoring/update-source-archive']){
    for(const file of await jsonFiles(root,dir)){
      let source;try{source=JSON.parse(await readFile(resolve(root,dir,file),'utf8'));}catch{continue;}
      const articleId=String(source.articleId??'');
      const url=source.targetUrl??(articleId?BLOG+'/'+articleId:null);
      if(!url||articleId===String(item.articleId)||!/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(url))continue;
      const title=norm(source.title);
      if(!title)continue;
      const tokens=[...new Set(title.split(/[\s·｜|,:()\-]+/u).map(norm).filter(x=>x.length>=2))];
      if(tokens.some(token=>haystack.includes(token)))out.push({label:title,url,source:'source'});
    }
  }
  return out;
}

export async function collectInternalLinks(root,item,currentHtml,evidence){
  const haystack=norm(plain(currentHtml)+' '+(evidence?.sources??[]).map(s=>String(s.title??'')+' '+String(s.notes??'')).join(' '));
  const curated=(evidence?.r53InternalLinks??[]).map(link=>({...link,source:'curated'}));
  const candidates=[...curated,...existingInternalLinks(currentHtml,item),...await catalogLinks(root,item,haystack)];
  const seen=new Set(),out=[];
  for(const link of candidates){
    if(seen.has(link.url))continue;
    seen.add(link.url);
    out.push({...link,key:'l'+(out.length+1)});
    if(out.length>=8)break;
  }
  return out;
}

function sourceScore(source,domain,modules){
  let score=source.topicSpecific===true?5:0;
  if(source.kind==='official'||source.kind==='guideline'||source.kind==='nutrition-database')score+=4;
  if(modules.includes('nutrition')&&source.role==='nutrition')score+=8;
  if(['safety','interactions'].some(m=>modules.includes(m))&&['safety','authorization'].includes(source.role))score+=8;
  if(domain==='medicine'&&source.role==='authorization')score+=8;
  if(domain==='disease'&&source.role==='health')score+=6;
  if(['benefits','long_term','combinations','treatment','indications'].some(m=>modules.includes(m))&&source.role==='health')score+=5;
  return score;
}

function sectionSources(evidence,domain,modules,sectionId=null){
  const curatedIds=sectionId&&evidence?.r53SectionEvidence?.[sectionId]?.sourceIds;
  if(Array.isArray(curatedIds)&&curatedIds.length)return curatedIds.filter(id=>(evidence?.sources??[]).some(source=>source.id===id));
  return [...(evidence?.sources??[])]
    .sort((a,b)=>sourceScore(b,domain,modules)-sourceScore(a,domain,modules))
    .slice(0,2)
    .map(s=>s.id);
}

function shortQuote(text){
  const value=norm(text);
  if(value.length<=90)return value;
  return norm(value.slice(0,70));
}

function medicalClaims(domain,sections){
  if(!['medicine','disease'].includes(domain))return [];
  return sections.map((section,index)=>{
    const text=norm(section.paragraphs?.[0]??'').slice(0,180);
    const type=domain==='medicine'
      ?(index===1?'treatment':index===3?'interaction':index===4?'disease':'general')
      :(index===4?'treatment':'disease');
    return {id:'r53c'+(index+1),text,type,risk:'high',sourceIds:section.sourceIds};
  }).filter(x=>x.text);
}

export async function writeR53Article(item,evidence,{model,fetcher=fetch,currentTitle='',internalLinks=[]}={}){
  const specs=R53_SECTION_SPECS[item.domain];
  if(!specs)throw new Error('E_R53_DOMAIN');
  const sourcePack=writerSources(item,evidence).map(s=>({
    id:s.id,title:s.title,kind:s.kind,role:s.role,url:s.url,
    facts:String(s.notes??'').slice(0,1800)
  }));
  const sectionEvidence=Object.fromEntries(specs.map(spec=>[
    spec.id,
    evidence?.r53SectionEvidence?.[spec.id]??{
      sourceIds:sectionSources(evidence,item.domain,spec.modules,spec.id),
      facts:sourcePack.filter(source=>sectionSources(evidence,item.domain,spec.modules,spec.id).includes(source.id)).map(source=>source.facts).filter(Boolean)
    }
  ]));
  const system='한국어 블로그 글 작성자다. 주제는 "'+item.keyword+'"이다. 제공된 6개 항목을 빠짐없이 같은 순서로 작성한다. 각 항목은 targetChars에 가까운 정보량으로 충분히 쓴다. 독자가 흥미를 느끼도록 표현은 강하고 인상적으로 쓴다. 각 항목은 해당 sectionEvidence의 facts를 중심으로 자연스럽게 풀어쓴다. internalLinks는 이미 확인된 우리 블로그 링크다. 해당 내용이 실제로 관련될 때 label을 본문에 자연스럽게 한 번 언급한다. JSON만 출력한다.';
  const raw=await ollamaJson([
    {role:'system',content:system},
    {role:'user',content:JSON.stringify({
      keyword:item.keyword,domain:item.domain,currentTitle,
      sections:specs.map(({id,heading,targetChars})=>({id,heading,targetChars,evidence:sectionEvidence[id]})),
      evidenceSources:sourcePack.map(({id,title,url})=>({id,title,url})),
      internalLinks:internalLinks.map(({key,label,url})=>({key,label,url}))
    })}
  ],writerSchema(specs),{model,fetcher,numPredict:5200,numCtx:12288});
  const byId=new Map((raw.sections??[]).map(s=>[s.id,s]));
  const sections=specs.map(spec=>{
    const written=byId.get(spec.id);
    if(!written)throw new Error('E_R53_SECTION_MISSING');
    const paragraphs=(written.paragraphs??[]).map(norm).filter(Boolean);
    if(!paragraphs.length)throw new Error('E_R53_SECTION_EMPTY');
    return {
      ...spec,paragraphs,
      sourceIds:sectionSources(evidence,item.domain,spec.modules,spec.id),
      strongPhrase:shortQuote(paragraphs[0])
    };
  });
  return {
    title:norm(raw.title),lead:norm(raw.lead),summary:norm(raw.summary),
    plan:{
      scope:'r53-simple',
      primaryQuestion:item.keyword+'에 대해 독자가 알고 싶은 핵심 내용을 6개 항목으로 확인한다.',
      readerSituation:item.keyword+'의 성분·효과·활용·주의 정보를 한 번에 확인하려는 독자다.',
      nextActions:[item.keyword+' 정보를 실제 선택과 활용에 적용한다.']
    },
    sections,
    claims:medicalClaims(item.domain,sections)
  };
}

function linkify(text,internalLinks,used){
  let out=esc(text);
  for(const link of internalLinks){
    if(used.has(link.url))continue;
    const label=esc(link.label);
    if(!label||!out.includes(label))continue;
    out=out.replace(label,'<a href="'+esc(link.url)+'"><strong>'+label+'</strong></a>');
    used.add(link.url);
  }
  return out;
}

function sourceLinks(evidence,ids){
  return ids.map(id=>(evidence?.sources??[]).find(s=>s.id===id)).filter(Boolean);
}

function imageAttribution(images){
  return images.map((x,i)=>'<li><a href="'+esc(x.sourcePage)+'">이미지 '+(i+1)+' 원출처</a> — '+esc(x.author)+', '+esc(x.license)+'</li>').join('');
}

export function renderR53Body(article,evidence,images,internalLinks=[]){
  const strict=article.plan?.scope==='evidence-first';
  const usedLinks=new Set();
  const imageTags=images.map(x=>{
    const image='<img src="'+esc(x.src)+'" alt="'+esc(x.alt)+'">';
    if(article.plan?.scope!=='food-sections')return '<p>'+image+'</p>';
    const credit=[x.author,x.license,x.licenseUrl].filter(Boolean).join(' — ');
    return '<p><a href="'+esc(x.sourcePage??x.src)+'" title="'+esc(credit)+'">'+image+'</a></p>';
  });
  const sectionImages=images.some(x=>Number.isInteger(x.sectionIndex));
  let html=(sectionImages?'':imageTags[0]??'')+'\n<p>'+esc(article.lead)+'</p>\n<blockquote><strong>핵심만 먼저:</strong> '+esc(article.summary)+'</blockquote>';
  article.sections.forEach((section,index)=>{
    html+='\n<h2>'+esc(section.heading)+'</h2>';
    if(article.plan?.scope==='food-sections')html+='\n'+renderFoodMarkdown(section.markdown);
    else {
    section.paragraphs.forEach((paragraph,pIndex)=>{
      let body=linkify(paragraph,internalLinks,usedLinks);
      const safetyKind=section.modules.includes('red_flags')?'danger':section.modules.includes('contraindications')?'caution':null;
      if(strict&&!safetyKind){
        const tags=['strong','mark','u','strong'];
        for(const [anchorIndex,anchor] of (section.anchors??[]).entries()){
          if(!paragraph.includes(anchor)||section.paragraphs.slice(0,pIndex).some(p=>p.includes(anchor)))continue;
          const tag=tags[anchorIndex],open=tag==='mark'?'<mark data-tone="key">':'<'+tag+'>';
          body=body.replace(esc(anchor),open+esc(anchor)+'</'+tag+'>');
        }
      }
      html+=strict&&safetyKind&&pIndex===0?'\n<blockquote data-kind="'+safetyKind+'"><p>'+body+'</p></blockquote>':'\n<p>'+body+'</p>';
    });
    }
    const citations=sourceLinks(evidence,section.sourceIds);
    if(citations.length)html+='\n<p>근거: '+citations.map(s=>'<a href="'+esc(s.url)+'">'+esc(s.title)+'</a>').join(' · ')+'</p>';
    if(sectionImages){images.forEach((image,i)=>{if(image.sectionIndex===index)html+='\n'+imageTags[i];});}
    else {
      if(index===1&&imageTags[1])html+='\n'+imageTags[1];
      if(index===3&&imageTags[2])html+='\n'+imageTags[2];
    }
  });
  if(article.plan?.scope!=='food-sections')html+='\n<h2>핵심 정리</h2><ul>'+article.sections.map(s=>'<li>'+esc(shortQuote(s.paragraphs[0]))+'</li>').join('')+'</ul>';
  const related=internalLinks.filter(link=>usedLinks.has(link.url)).slice(0,5);
  if(related.length){
    html+='\n<h2>함께 보면 좋은 글</h2>';
    for(const link of related)html+='\n<p><a href="'+esc(link.url)+'"><strong>'+esc(link.label)+'</strong></a></p>';
  }
  if(article.plan?.scope!=='food-sections')html+='\n<h2>자료 출처</h2><ul>'+(evidence?.sources??[]).map(s=>'<li><a href="'+esc(s.url)+'">'+esc(s.title)+'</a> — 자료 확인일 '+esc(s.checkedAt)+'</li>').join('')+imageAttribution(images)+'</ul>';
  if(article.plan?.scope==='food-sections')html=applyFoodDesign(html);
  return strict?glossaryPass(html):{html,glossary:[]};
}
