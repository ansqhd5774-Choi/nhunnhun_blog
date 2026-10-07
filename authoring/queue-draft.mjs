import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ollamaJson } from './queue-ollama.mjs';
import { DOMAIN_RULES } from '../publishing/content-standards.mjs';
import { EXTENSIONS } from '../publishing/standards/common.mjs';

const GLOSSARY_DEFS=Object.freeze({
  '생체이용률':'섭취한 성분이 몸에서 이용될 수 있는 정도',
  '혈소판 응집':'혈소판이 서로 달라붙어 피떡 형성에 관여하는 과정',
  '인슐린 저항성':'인슐린이 있어도 몸의 세포가 혈당을 잘 받아들이지 못하는 상태',
  '고칼륨혈증':'혈액 속 칼륨 농도가 정상보다 높은 상태',
  '메타분석':'여러 연구 결과를 함께 모아 분석하는 방법',
  '무작위 대조시험':'참가자를 무작위로 나눠 치료나 중재 효과를 비교하는 연구',
});
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export function requiredModules(item,extensions){
  const out=new Set(DOMAIN_RULES[item.domain].core);
  for(const [key,entry] of Object.entries(extensions))if(entry.applies)for(const module of EXTENSIONS[key])out.add(module);
  return [...out];
}
function schema(required,sources){
  return {type:'object',additionalProperties:false,required:['title','summary','sections','reviewNotes'],properties:{
    title:{type:'string',minLength:8,maxLength:150},
    summary:{type:'string',minLength:30,maxLength:260},
    reviewNotes:{type:'string',minLength:20,maxLength:1200},
    sections:{type:'array',minItems:4,maxItems:14,items:{type:'object',additionalProperties:false,required:['id','heading','strongPoint','paragraphs','keyPoint','contrastPoint','actionPoint','modules','sourceIds'],properties:{
      id:{type:'string',pattern:'^[a-z][a-z0-9-]{1,40}$'},
      heading:{type:'string',minLength:6,maxLength:90},
      strongPoint:{type:'string',minLength:12,maxLength:100},
      paragraphs:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:25,maxLength:220}},
      keyPoint:{type:'string',minLength:12,maxLength:65},
      contrastPoint:{type:'string',minLength:8,maxLength:65},
      actionPoint:{type:'string',minLength:10,maxLength:100},
      modules:{type:'array',minItems:1,items:{type:'string',enum:required}},
      sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sources.map(s=>s.id)}}
    }}}
  }};
}
function assertSectionIds(article){
  const ids=new Set();
  for(const section of article.sections){
    if(ids.has(section.id))throw new Error('E_QUEUE_SECTION_ID');
    ids.add(section.id);
  }
}
export function missingRequiredModules(article,required){
  const covered=new Set((article?.sections??[]).flatMap(s=>s.modules??[]));
  return required.filter(module=>!covered.has(module));
}
function sourceBundle(evidence){
  return evidence.sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,topicSpecific:s.topicSpecific===true,notes:s.notes.slice(0,3000)}));
}
async function initialDraft(item,evidence,extensions,required,{model,fetcher}){
  return ollamaJson([
    {role:'system',content:`한국어 건강 블로그 작성자다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 식품·성분·질병으로 재해석하지 않는다. 필수 모듈은 ${required.join(', ')}이다. 각 필수 모듈은 sections.modules에 최소 한 번 포함해야 한다. 제공 자료 밖에서 수치·효능·용량·상호작용을 만들지 않는다. 일반 채소·일반 식단 자료를 이 식품만의 효능으로 바꾸지 않는다. 연구기간을 개인의 효과 보장기간으로 바꾸지 않는다. strongPoint/keyPoint/contrastPoint/actionPoint는 서로 다른 정보이며 모두 근거 안에서 쓴다. 독자가 실제 궁금해하는 질문 순서로 작성하고 같은 말을 반복하지 않는다. 의사 자격이나 검토 PASS를 주장하지 않는다.`},
    {role:'user',content:JSON.stringify({keyword:item.keyword,canonicalEnglishQuery:evidence.query,domain:item.domain,category:item.category,currentUrl:item.targetUrl,requiredModules:required,extensions,sources:sourceBundle(evidence)})}
  ],schema(required,evidence.sources),{model,fetcher,numPredict:9000});
}
async function repairCoverage(item,evidence,extensions,required,article,missing,{model,fetcher}){
  return ollamaJson([
    {role:'system',content:`기존 한국어 건강 글 초안을 교정한다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 절대 다른 대상(예: 다른 채소)으로 바꾸지 않는다. 현재 빠진 필수 모듈은 ${missing.join(', ')}이다. 기존 근거 안에서 이미 해당 내용을 설명한 섹션에는 정확한 modules 태그를 추가하고, 실제 근거가 충분한 경우에만 짧은 섹션을 보완한다. 근거가 없으면 내용을 만들어 채우지 않는다. 제공된 source id만 사용한다. 수정 후 모든 필수 모듈을 sections.modules에서 최소 한 번 포함한다.`},
    {role:'user',content:JSON.stringify({existingArticle:article,requiredModules:required,missingModules:missing,extensions,sources:sourceBundle(evidence)})}
  ],schema(required,evidence.sources),{model,fetcher,numPredict:9000});
}
export async function draftArticle(item,evidence,extensions,{model,fetcher=fetch}={}){
  const required=requiredModules(item,extensions);
  let article=await initialDraft(item,evidence,extensions,required,{model,fetcher});
  assertSectionIds(article);
  let missing=missingRequiredModules(article,required);
  if(missing.length){
    article=await repairCoverage(item,evidence,extensions,required,article,missing,{model,fetcher});
    assertSectionIds(article);
    missing=missingRequiredModules(article,required);
  }
  if(missing.length)throw Object.assign(new Error('E_QUEUE_REQUIRED_MODULE'),{details:{missing,required}});
  return {article,required};
}
export async function reusableImages(root,item){
  const files=(await readdir(resolve(root,'updates'))).filter(n=>n.endsWith('.json')).sort().reverse();
  for(const file of files){
    let source;try{source=JSON.parse(await readFile(resolve(root,'updates',file),'utf8'));}catch{continue;}
    if(source.articleId!==item.articleId||!Array.isArray(source.imageReview)||source.imageReview.length<3)continue;
    const images=source.imageReview.slice(0,3);
    if(images.every(x=>x?.visualChecked===true&&x.src&&x.sourcePage&&x.author&&x.license)&&images[0].role==='hero'&&images[0].composition==='closeup')return images;
  }
  throw new Error('E_QUEUE_IMAGE_REVIEW_REQUIRED');
}
function attribution(images){
  return images.map((x,i)=>`<li><a href="${esc(x.sourcePage)}">이미지 ${i+1} 원출처</a> — ${esc(x.author)}, ${esc(x.license)}</li>`).join('');
}
function glossaryPass(html){
  const glossary=[];let out=html;
  for(const [term,explanation] of Object.entries(GLOSSARY_DEFS)){
    if(out.includes(term)&&!out.includes(explanation))out=out.replace(term,`${term}(${explanation})`);
    if(out.includes(term)&&out.includes(explanation))glossary.push({term,explanation});
  }
  return {html:out,glossary};
}
export function renderBody(article,evidence,images){
  const imageTags=images.map(x=>`<p><img src="${esc(x.src)}" alt="${esc(x.alt)}"></p>`);
  let html=imageTags[0]+`\n<p><strong>${esc(article.summary)}</strong></p>`;
  const p1=Math.max(1,Math.floor(article.sections.length/3));
  const p2=Math.max(p1+1,Math.floor(article.sections.length*2/3));
  article.sections.forEach((section,index)=>{
    html+=`\n<h2>${esc(section.heading)}</h2>`;
    html+=`\n<p><strong>${esc(section.strongPoint)}</strong> ${esc(section.paragraphs[0])}</p>`;
    for(const p of section.paragraphs.slice(1))html+=`\n<p>${esc(p)}</p>`;
    html+=`\n<p><strong>${esc(section.actionPoint)}</strong> 비교해서 볼 부분은 <u>${esc(section.contrastPoint)}</u>이며, 핵심은 <mark data-tone="key">${esc(section.keyPoint)}</mark>입니다.</p>`;
    html+=`\n<p>${section.sourceIds.map(id=>{const s=evidence.sources.find(x=>x.id===id);return `<a href="${esc(s.url)}">${esc(s.title)}</a>`;}).join(' · ')}</p>`;
    if(index===p1-1)html+=`\n${imageTags[1]}`;
    if(index===p2-1)html+=`\n${imageTags[2]}`;
  });
  html+=`\n<h2>핵심 정리</h2><ul>${article.sections.slice(0,7).map(s=>`<li>${esc(s.keyPoint)}</li>`).join('')}</ul>`;
  html+=`\n<h2>자료 출처</h2><ul>${evidence.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a> — 자료 확인일 ${s.checkedAt}</li>`).join('')}${attribution(images)}</ul>`;
  return glossaryPass(html);
}
