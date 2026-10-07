import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ollamaJson } from './queue-ollama.mjs';
import { EXTENSIONS } from '../publishing/standards/common.mjs';
import { lengthBandForScope } from './queue-plan.mjs';

const GLOSSARY_DEFS=Object.freeze({
  '생체이용률':'섭취한 성분이 몸에서 이용될 수 있는 정도',
  '혈소판 응집':'혈소판이 서로 달라붙어 피떡 형성에 관여하는 과정',
  '인슐린 저항성':'인슐린이 있어도 몸의 세포가 혈당을 잘 받아들이지 못하는 상태',
  '고칼륨혈증':'혈액 속 칼륨 농도가 정상보다 높은 상태',
  '메타분석':'여러 연구 결과를 함께 모아 분석하는 방법',
  '무작위 대조시험':'참가자를 무작위로 나눠 치료나 중재 효과를 비교하는 연구',
});
const HIGH_RISK_TYPES=new Set(['dose','interaction','disease','treatment']);
const HIGH_RISK_TEXT=/(질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const norm=v=>String(v??'').normalize('NFC').replace(/\s+/g,' ').trim();

export function conservativeExtensions(item){
  return Object.fromEntries(Object.keys(EXTENSIONS).map(key=>[key,{
    applies:false,
    reason:`${item.keyword}의 선택 확장 질문은 자동 필수화하지 않고 직접 근거와 검색 의도가 함께 확인될 때만 본문에서 다룬다.`
  }]));
}

function writerSchema(plan){
  const ids=plan.sections.map(s=>s.id);
  return {type:'object',additionalProperties:false,required:['title','lead','summary','sections'],properties:{
    title:{type:'string',minLength:8,maxLength:150},
    lead:{type:'string',minLength:30,maxLength:220},
    summary:{type:'string',minLength:30,maxLength:220},
    sections:{type:'array',minItems:ids.length,maxItems:ids.length,items:{type:'object',additionalProperties:false,required:['id','paragraphs','strongPhrase','highlightPhrase','underlinePhrase'],properties:{
      id:{type:'string',enum:ids},
      paragraphs:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:30,maxLength:190}},
      strongPhrase:{type:'string',minLength:2,maxLength:70},
      highlightPhrase:{type:'string',minLength:2,maxLength:70},
      underlinePhrase:{type:'string',maxLength:60}
    }}}
  }};
}
function patchSchema(ids){
  return {type:'object',additionalProperties:false,required:['sections'],properties:{
    sections:{type:'array',minItems:ids.length,maxItems:ids.length,items:{type:'object',additionalProperties:false,required:['id','paragraphs','strongPhrase','highlightPhrase','underlinePhrase'],properties:{
      id:{type:'string',enum:ids},
      paragraphs:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:30,maxLength:190}},
      strongPhrase:{type:'string',minLength:2,maxLength:70},
      highlightPhrase:{type:'string',minLength:2,maxLength:70},
      underlinePhrase:{type:'string',maxLength:60}
    }}}
  }};
}
function writerBudget(scope){
  return ({focused:2800,standard:4000,comprehensive:5500,deep:6500})[scope]??4000;
}
function claimBundle(plan){
  return plan.sections.map(section=>({
    id:section.id,heading:section.heading,question:section.question,modules:section.modules,
    approvedClaims:section.claims.map(({id,text,type,risk})=>({id,text,type,risk}))
  }));
}
export async function writeArticleFromPlan(item,plan,scope,{model,fetcher=fetch}={}){
  const [min,max]=lengthBandForScope(scope);
  return ollamaJson([
    {role:'system',content:`한국어 건강정보 글 작성자다. 이미 코드 검증을 통과한 Evidence Plan만 자연스러운 본문으로 변환한다. canonicalSubject는 "${item.keyword}"이며 다른 대상으로 바꾸지 않는다. 새로운 사실·수치·효능·용량·상호작용·질병효과를 추가하지 않는다. 각 section의 approvedClaims만 설명하고, 그 범위 안에서 연결문장·쉬운 풀이만 덧붙인다. 검색 범위는 ${scope}, 권장 공개 본문은 ${min}~${max}자이지만 글자수를 채우려고 반복하지 않는다. 답이 끝나면 즉시 완전한 JSON을 닫는다. section id는 plan과 정확히 일치해야 한다. strongPhrase, highlightPhrase는 paragraphs 안에 실제 존재하는 서로 다른 짧은 구절을 그대로 복사한다. underlinePhrase도 필요한 경우 paragraphs의 실제 구절을 복사하고 필요 없으면 빈 문자열이다. 강조를 위해 새로운 문장을 만들지 않는다. 같은 내용을 표현만 바꿔 반복하지 않는다. JSON만 출력한다.`},
    {role:'user',content:JSON.stringify({keyword:item.keyword,scope,primaryQuestion:plan.primaryQuestion,readerSituation:plan.readerSituation,sections:claimBundle(plan)})}
  ],writerSchema(plan),{model,fetcher,numPredict:writerBudget(scope),numCtx:12288});
}

function numericTokens(text){
  const out=[];
  for(const match of String(text??'').matchAll(/\b\d+(?:[.,]\d+)?(?:\s*(?:kcal|mg|mcg|μg|µg|g|kg|ml|mL|l|L|%|회|일|주|개월|년|℃|°C))?/g)){
    const raw=match[0].replace(/,/g,'').replace(/\s+/g,'').replace(/µg|μg/g,'mcg').toLowerCase();
    const n=Number(raw.match(/^\d+(?:\.\d+)?/)?.[0]);
    if(Number.isInteger(n)&&n>=1900&&n<=2100&&!/[a-z%℃°가-힣]/i.test(raw.replace(/^\d+(?:\.\d+)?/,'')))continue;
    out.push(raw);
  }
  return [...new Set(out)];
}
function sectionPlanMap(plan){return new Map(plan.sections.map(section=>[section.id,section]));}
function highRiskPlan(section){return section.claims.some(claim=>claim.risk==='high'||HIGH_RISK_TYPES.has(claim.type)||HIGH_RISK_TEXT.test(claim.text));}
function phraseOverlap(a,b){
  a=norm(a);b=norm(b);if(!a||!b)return false;
  return a===b||a.includes(b)||b.includes(a);
}
function sectionText(section){return norm((section.paragraphs??[]).join(' '));}
function duplicateFailures(article){
  const failures=[];
  for(const section of article?.sections??[]){
    const paragraphs=(section.paragraphs??[]).map(norm).filter(Boolean);
    for(let i=0;i<paragraphs.length;i++)for(let j=i+1;j<paragraphs.length;j++){
      if(paragraphs[i]===paragraphs[j]||(Math.min(paragraphs[i].length,paragraphs[j].length)>=40&&(paragraphs[i].includes(paragraphs[j])||paragraphs[j].includes(paragraphs[i])))){
        failures.push({code:'DUPLICATE_SECTION_TEXT',sectionId:section.id});
      }
    }
  }
  return failures;
}
export function validateWrittenArticle(draft,plan){
  const failures=[],planById=sectionPlanMap(plan),draftIds=(draft?.sections??[]).map(s=>s.id);
  const expected=plan.sections.map(s=>s.id);
  if(draftIds.length!==expected.length||new Set(draftIds).size!==expected.length||expected.some(id=>!draftIds.includes(id)))failures.push({code:'ARTICLE_SECTION_SET'});
  const allowedNumbers=new Set(plan.sections.flatMap(section=>section.claims.flatMap(claim=>numericTokens(claim.text))));
  for(const token of numericTokens(`${draft?.title??''} ${draft?.lead??''} ${draft?.summary??''}`))if(!allowedNumbers.has(token))failures.push({code:'ARTICLE_UNDECLARED_NUMBER',token});
  for(const section of draft?.sections??[]){
    const planned=planById.get(section.id);
    if(!planned){failures.push({code:'ARTICLE_SECTION_UNKNOWN',sectionId:section.id});continue;}
    const text=sectionText(section);
    for(const [field,value] of [['strongPhrase',section.strongPhrase],['highlightPhrase',section.highlightPhrase],['underlinePhrase',section.underlinePhrase]]){
      if(field==='underlinePhrase'&&!norm(value))continue;
      if(!text.includes(norm(value)))failures.push({code:'ARTICLE_EMPHASIS_NOT_IN_BODY',sectionId:section.id,field});
    }
    if(phraseOverlap(section.strongPhrase,section.highlightPhrase)||phraseOverlap(section.strongPhrase,section.underlinePhrase)||phraseOverlap(section.highlightPhrase,section.underlinePhrase)){
      failures.push({code:'ARTICLE_EMPHASIS_OVERLAP',sectionId:section.id});
    }
    const charCount=Array.from(text).length;
    if(charCount>=250&&!norm(section.underlinePhrase))failures.push({code:'ARTICLE_SCAN_ANCHOR',sectionId:section.id});
    const allowedSectionNumbers=new Set(planned.claims.flatMap(claim=>numericTokens(claim.text)));
    for(const token of numericTokens(text))if(!allowedSectionNumbers.has(token))failures.push({code:'ARTICLE_UNDECLARED_NUMBER',sectionId:section.id,token});
    if(HIGH_RISK_TEXT.test(text)&&!highRiskPlan(planned))failures.push({code:'ARTICLE_UNDECLARED_HIGH_RISK',sectionId:section.id});
  }
  failures.push(...duplicateFailures(draft));
  return failures;
}
export function patchableSectionIds(failures,plan){
  const allowed=new Set(plan.sections.map(s=>s.id));
  return [...new Set((failures??[]).map(f=>f.sectionId).filter(id=>allowed.has(id)))];
}
export async function repairArticleSections(item,plan,draft,failures,{model,fetcher=fetch}={}){
  const ids=patchableSectionIds(failures,plan);
  if(!ids.length)throw Object.assign(new Error('E_QUEUE_DRAFT_UNPATCHABLE'),{details:failures});
  const planById=sectionPlanMap(plan),draftById=new Map(draft.sections.map(s=>[s.id,s]));
  const sections=ids.map(id=>({
    plan:{id,heading:planById.get(id).heading,question:planById.get(id).question,approvedClaims:planById.get(id).claims.map(({id,text,type,risk})=>({id,text,type,risk}))},
    current:draftById.get(id),
    failures:failures.filter(f=>f.sectionId===id)
  }));
  return ollamaJson([
    {role:'system',content:`한국어 건강정보 원고의 실패한 섹션만 한 번 교정한다. 전체 글을 다시 쓰지 않는다. canonicalSubject는 "${item.keyword}"이다. 각 patch는 제공된 approvedClaims만 설명하고 새로운 사실·수치·효능을 추가하지 않는다. 실패 코드만 해결하고 다른 섹션은 건드리지 않는다. strongPhrase, highlightPhrase, underlinePhrase는 paragraphs 안의 실제 서로 다른 구절이어야 한다. 같은 설명을 반복하지 않는다. JSON만 출력한다.`},
    {role:'user',content:JSON.stringify({sections})}
  ],patchSchema(ids),{model,fetcher,numPredict:Math.min(1800,600+ids.length*350),numCtx:8192});
}
export function applySectionPatches(draft,patch){
  const patchById=new Map((patch?.sections??[]).map(s=>[s.id,s]));
  return {...draft,sections:draft.sections.map(section=>patchById.has(section.id)?patchById.get(section.id):section)};
}
export function mergePlanAndDraft(plan,draft){
  const draftById=new Map(draft.sections.map(s=>[s.id,s]));
  const sections=plan.sections.map(planned=>{
    const written=draftById.get(planned.id);
    if(!written)throw new Error('E_QUEUE_DRAFT_SECTION_MISSING');
    return {
      id:planned.id,heading:planned.heading,question:planned.question,modules:planned.modules,
      sourceIds:[...new Set(planned.claims.flatMap(claim=>claim.sourceIds))],claims:planned.claims,
      paragraphs:written.paragraphs,strongPhrase:written.strongPhrase,highlightPhrase:written.highlightPhrase,underlinePhrase:written.underlinePhrase
    };
  });
  return {title:draft.title,lead:draft.lead,summary:draft.summary,plan:{scope:null,primaryQuestion:plan.primaryQuestion,readerSituation:plan.readerSituation,nextActions:plan.nextActions},sections,claims:plan.sections.flatMap(s=>s.claims)};
}
export function visibleCharacterCount(article){
  const parts=[article?.title,article?.lead,article?.summary,...(article?.sections??[]).flatMap(s=>[s.heading,...(s.paragraphs??[])])];
  return Array.from(parts.map(norm).filter(Boolean).join(' ')).length;
}
export function buildLengthReport(article,scope){
  const [min,max]=lengthBandForScope(scope),visibleCharacters=visibleCharacterCount(article);
  return {
    scope,recommendedBand:[min,max],visibleCharacters,
    status:visibleCharacters<min?'low':visibleCharacters>max?'high':'in-band',
    sectionCount:article?.sections?.length??0,
    duplicateCandidates:duplicateFailures(article),
    includedModules:[...new Set((article?.sections??[]).flatMap(s=>s.modules??[]))]
  };
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
function emphasize(text,section){
  let out=esc(text);
  const replacements=[
    ['strongPhrase','strong'],
    ['highlightPhrase','mark'],
    ['underlinePhrase','u'],
  ];
  for(const [field,tag] of replacements){
    const phrase=esc(section[field]);
    if(!phrase||!out.includes(phrase))continue;
    const open=tag==='mark'?'<mark data-tone="key">':`<${tag}>`;
    out=out.replace(phrase,`${open}${phrase}</${tag}>`);
  }
  return out;
}
export function renderBody(article,evidence,images){
  const imageTags=images.map(x=>`<p><img src="${esc(x.src)}" alt="${esc(x.alt)}"></p>`);
  let html=imageTags[0]+`\n<p>${esc(article.lead??article.title)}</p>\n<blockquote><strong>핵심만 먼저:</strong> ${esc(article.summary)}</blockquote>`;
  const p1=Math.max(1,Math.floor(article.sections.length/3));
  const p2=Math.max(p1+1,Math.floor(article.sections.length*2/3));
  article.sections.forEach((section,index)=>{
    html+=`\n<h2>${esc(section.heading)}</h2>`;
    const safetyKind=section.modules.includes('red_flags')?'danger':section.modules.includes('contraindications')?'caution':null;
    section.paragraphs.forEach((paragraph,pIndex)=>{
      const body=emphasize(paragraph,section);
      if(safetyKind&&pIndex===0)html+=`\n<blockquote data-kind="${safetyKind}"><p>${body}</p></blockquote>`;
      else html+=`\n<p>${body}</p>`;
    });
    html+=`\n<p>${section.sourceIds.map(id=>{const s=evidence.sources.find(x=>x.id===id);return `<a href="${esc(s.url)}">${esc(s.title)}</a>`;}).join(' · ')}</p>`;
    if(index===p1-1)html+=`\n${imageTags[1]}`;
    if(index===p2-1)html+=`\n${imageTags[2]}`;
  });
  html+=`\n<h2>핵심 정리</h2><ul>${article.sections.slice(0,7).map(s=>`<li>${esc(s.strongPhrase)}</li>`).join('')}</ul>`;
  html+=`\n<h2>자료 출처</h2><ul>${evidence.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a> — 자료 확인일 ${s.checkedAt}</li>`).join('')}${attribution(images)}</ul>`;
  return glossaryPass(html);
}
