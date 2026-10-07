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
  return {type:'object',additionalProperties:false,required:['title','lead','summary','sections','reviewNotes'],properties:{
    title:{type:'string',minLength:8,maxLength:150},
    lead:{type:'string',minLength:30,maxLength:260},
    summary:{type:'string',minLength:30,maxLength:260},
    reviewNotes:{type:'string',minLength:20,maxLength:1200},
    sections:{type:'array',minItems:4,maxItems:14,items:{type:'object',additionalProperties:false,required:['id','heading','strongPoint','paragraphs','keyPoint','contrastPoint','actionPoint','modules','sourceIds'],properties:{
      id:{type:'string',pattern:'^[a-z][a-z0-9-]{1,40}$'},
      heading:{type:'string',minLength:6,maxLength:90},
      strongPoint:{type:'string',minLength:12,maxLength:100},
      paragraphs:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:25,maxLength:220}},
      keyPoint:{type:'string',minLength:12,maxLength:65},
      contrastPoint:{type:'string',maxLength:65},
      actionPoint:{type:'string',maxLength:100},
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
  return evidence.sources.map(s=>({id:s.id,title:s.title,kind:s.kind,role:s.role,topicSpecific:s.topicSpecific===true,scopeNote:s.scopeNote,notes:s.notes.slice(0,3000)}));
}
async function initialDraft(item,evidence,extensions,required,{model,fetcher}){
  return ollamaJson([
    {role:'system',content:`한국어 건강 블로그 작성자다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 분야 안내: ${DOMAIN_RULES[item.domain].guidance} 필수 질문 모듈은 ${required.join(', ')}이다. 질문을 검토하고 실제 답한 섹션에 modules를 연결한다. 필수 질문의 수치·효과를 확인할 수 없으면 확인한 자료의 범위와 한계를 설명한다. 자료에 없다는 사실을 세상에 근거가 없다는 결론으로 확대하지 않는다. 개인별 안전 판단에 필요한 공식 허가사항·위험신호가 없으면 안전한 내용을 꾸미지 말고 reviewNotes에 차단 사유를 적는다. 선택 확장 질문은 true인 것만 포함한다. 제공 자료 밖에서 수치·효능·용량·상호작용을 만들지 않는다. 일반 지침은 해당되는 생활 안내로만 쓰고 개별 효능으로 확대하지 않는다. 농업·동물·시험관 자료를 사람의 치료·예방 효과로 바꾸지 않는다. lead는 독자의 질문을 소개하고 summary는 그 질문에 먼저 답한다. strongPoint와 keyPoint는 짧고 서로 다른 사실이다. contrastPoint는 실제 비교가 있을 때만, actionPoint는 근거 있는 추가 행동이 있을 때만 쓰고 아니면 빈 문자열이다. 같은 문장을 다시 쓰거나 형식을 채우기 위해 비교·권장량·결핍증을 만들지 않는다. 의사 자격이나 검토 PASS를 주장하지 않는다.`},
    {role:'user',content:JSON.stringify({keyword:item.keyword,canonicalEnglishQuery:evidence.query,domain:item.domain,category:item.category,currentUrl:item.targetUrl,requiredModules:required,extensions,sources:sourceBundle(evidence)})}
  ],schema(required,evidence.sources),{model,fetcher,numPredict:9000});
}
async function repairCoverage(item,evidence,extensions,required,article,missing,{model,fetcher}){
  return ollamaJson([
    {role:'system',content:`기존 한국어 건강 글 초안을 교정한다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 바꾸지 않는다. 빠진 질문 모듈은 ${missing.join(', ')}이다. 이미 실제 답한 섹션에만 modules 태그를 연결한다. 근거가 충분할 때만 내용을 보완한다. 수치·효과가 확인되지 않으면 확인한 자료의 한계와 독자가 판단할 수 있는 범위를 설명하는 것도 답이다. 자료에 없다는 사실을 세계 전체 근거 부재로 확대하지 않는다. 필요한 의료 안전정보 부재를 한계 문구로 대체하지 않는다. 근거 없는 사실이나 빈 태그로 검사를 통과시키지 않는다. 제공된 source id만 사용하고 불필요한 비교·행동은 빈 문자열로 둔다.`},
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
  let html=imageTags[0]+`\n<p>${esc(article.lead??article.title)}</p>\n<blockquote><strong>핵심만 먼저:</strong> ${esc(article.summary)}</blockquote>`;
  const p1=Math.max(1,Math.floor(article.sections.length/3));
  const p2=Math.max(p1+1,Math.floor(article.sections.length*2/3));
  article.sections.forEach((section,index)=>{
    html+=`\n<h2>${esc(section.heading)}</h2>`;
    html+=`\n<p><strong>${esc(section.strongPoint)}</strong> ${esc(section.paragraphs[0])}</p>`;
    for(const p of section.paragraphs.slice(1))html+=`\n<p>${esc(p)}</p>`;
    const safetyKind=section.modules.includes('red_flags')?'danger':section.modules.includes('contraindications')?'caution':null;
    if(safetyKind)html+=`\n<blockquote data-kind="${safetyKind}"><p>${esc(section.keyPoint)}</p></blockquote>`;
    else html+=`\n<p><mark data-tone="key">${esc(section.keyPoint)}</mark></p>`;
    if(section.contrastPoint?.trim())html+=`\n<p><u>${esc(section.contrastPoint)}</u></p>`;
    if(section.actionPoint?.trim())html+=`\n<p><strong>${esc(section.actionPoint)}</strong></p>`;
    html+=`\n<p>${section.sourceIds.map(id=>{const s=evidence.sources.find(x=>x.id===id);return `<a href="${esc(s.url)}">${esc(s.title)}</a>`;}).join(' · ')}</p>`;
    if(index===p1-1)html+=`\n${imageTags[1]}`;
    if(index===p2-1)html+=`\n${imageTags[2]}`;
  });
  html+=`\n<h2>핵심 정리</h2><ul>${article.sections.slice(0,7).map(s=>`<li>${esc(s.keyPoint)}</li>`).join('')}</ul>`;
  html+=`\n<h2>자료 출처</h2><ul>${evidence.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a> — 자료 확인일 ${s.checkedAt}</li>`).join('')}${attribution(images)}</ul>`;
  return glossaryPass(html);
}
