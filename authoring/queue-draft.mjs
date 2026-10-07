import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ollamaJson } from './queue-ollama.mjs';
import { DOMAIN_RULES } from '../publishing/content-standards.mjs';
import { EXTENSIONS, MODULES } from '../publishing/standards/common.mjs';

const GLOSSARY_DEFS=Object.freeze({
  '생체이용률':'섭취한 성분이 몸에서 이용될 수 있는 정도',
  '혈소판 응집':'혈소판이 서로 달라붙어 피떡 형성에 관여하는 과정',
  '인슐린 저항성':'인슐린이 있어도 몸의 세포가 혈당을 잘 받아들이지 못하는 상태',
  '고칼륨혈증':'혈액 속 칼륨 농도가 정상보다 높은 상태',
  '메타분석':'여러 연구 결과를 함께 모아 분석하는 방법',
  '무작위 대조시험':'참가자를 무작위로 나눠 치료나 중재 효과를 비교하는 연구',
});
const CLAIM_TYPES=['general','nutrition','benefit','safety','dose','interaction','disease','treatment'];
const HIGH_RISK_TYPES=new Set(['dose','interaction','disease','treatment']);
const SCOPE_BANDS=Object.freeze({
  focused:[1200,2200],
  standard:[2200,3800],
  comprehensive:[3500,5200],
  deep:[4500,6500],
});
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
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

export function conservativeExtensions(item){
  return Object.fromEntries(Object.keys(EXTENSIONS).map(key=>[key,{
    applies:false,
    reason:`${item.keyword}의 선택 확장 질문은 자동 필수화하지 않고 직접 근거와 검색 의도가 함께 확인될 때만 본문에서 다룬다.`
  }]));
}

export function requiredModules(item,_extensions={}){
  return [...DOMAIN_RULES[item.domain].core];
}

function schema(required,sources){
  const moduleNames=Object.keys(MODULES),sourceIds=sources.map(s=>s.id);
  return {type:'object',additionalProperties:false,required:['title','lead','summary','plan','sections','claims','reviewNotes'],properties:{
    title:{type:'string',minLength:8,maxLength:150},
    lead:{type:'string',minLength:30,maxLength:240},
    summary:{type:'string',minLength:30,maxLength:240},
    reviewNotes:{type:'string',minLength:20,maxLength:1000},
    plan:{type:'object',additionalProperties:false,required:['scope','primaryQuestion','readerSituation','nextActions'],properties:{
      scope:{type:'string',enum:Object.keys(SCOPE_BANDS)},
      primaryQuestion:{type:'string',minLength:12,maxLength:220},
      readerSituation:{type:'string',minLength:12,maxLength:220},
      nextActions:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:10,maxLength:140}}
    }},
    sections:{type:'array',minItems:4,maxItems:12,items:{type:'object',additionalProperties:false,required:['id','heading','strongPoint','paragraphs','highlightPhrase','underlinePhrase','modules','sourceIds'],properties:{
      id:{type:'string',pattern:'^[a-z][a-z0-9-]{1,40}$'},
      heading:{type:'string',minLength:6,maxLength:90},
      strongPoint:{type:'string',minLength:12,maxLength:90},
      paragraphs:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:25,maxLength:220}},
      highlightPhrase:{type:'string',minLength:2,maxLength:70},
      underlinePhrase:{type:'string',maxLength:60},
      modules:{type:'array',minItems:1,items:{type:'string',enum:moduleNames}},
      sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}}
    }}},
    claims:{type:'array',minItems:1,maxItems:24,items:{type:'object',additionalProperties:false,required:['id','sectionId','text','type','risk','sourceIds'],properties:{
      id:{type:'string',pattern:'^c[0-9]{1,2}$'},
      sectionId:{type:'string',pattern:'^[a-z][a-z0-9-]{1,40}$'},
      text:{type:'string',minLength:8,maxLength:220},
      type:{type:'string',enum:CLAIM_TYPES},
      risk:{type:'string',enum:['low','high']},
      sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}}
    }}
  }};
}

function sourceBundle(evidence){
  return evidence.sources.map(s=>({
    id:s.id,title:s.title,kind:s.kind,role:s.role,topicSpecific:s.topicSpecific===true,
    scopeNote:s.scopeNote,notes:s.notes.slice(0,2200)
  }));
}
function outputBudget(scope){
  const upper=lengthBandForScope(scope)[1];
  return Math.min(4200,Math.max(2200,Math.ceil(upper/1.8)+650));
}
function allSectionText(section){return [section.strongPoint,...(section.paragraphs??[])].map(norm).filter(Boolean);}
function duplicateFailures(article){
  const failures=[];
  for(const section of article?.sections??[]){
    const values=allSectionText(section);
    for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++){
      const a=values[i],b=values[j];
      if(a===b || (Math.min(a.length,b.length)>=30 && (a.includes(b)||b.includes(a)))) failures.push({code:'DUPLICATE_SECTION_TEXT',sectionId:section.id});
    }
  }
  return failures;
}
function claimSourceCompatible(claim,source){
  if(claim.type==='nutrition')return ['nutrition','health'].includes(source.role);
  if(claim.type==='safety')return ['safety','authorization','health'].includes(source.role);
  if(claim.type==='dose'||claim.type==='interaction')return ['authorization','safety','health'].includes(source.role);
  if(claim.type==='benefit'||claim.type==='disease'||claim.type==='treatment')return ['health','nutrition','authorization'].includes(source.role);
  return true;
}
function inferredHighRisk(claim){
  return claim.risk==='high'||HIGH_RISK_TYPES.has(claim.type)||/(질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|심각한 부작용)/u.test(claim.text??'');
}
function claimFailures(article,evidence){
  const failures=[],sourceById=new Map(evidence.sources.map(s=>[s.id,s])),sectionIds=new Set((article?.sections??[]).map(s=>s.id));
  for(const claim of article?.claims??[]){
    if(!sectionIds.has(claim.sectionId)){failures.push({code:'CLAIM_SECTION',claimId:claim.id});continue;}
    const sources=(claim.sourceIds??[]).map(id=>sourceById.get(id)).filter(Boolean);
    if(sources.length!==(claim.sourceIds??[]).length||!sources.length){failures.push({code:'CLAIM_SOURCE',claimId:claim.id});continue;}
    if(!sources.some(source=>claimSourceCompatible(claim,source)))failures.push({code:'CLAIM_SCOPE',claimId:claim.id,type:claim.type});
    if(inferredHighRisk(claim)&&!sources.some(source=>['official','guideline','systematic-review','trial','nutrition-database'].includes(source.kind))){
      failures.push({code:'CLAIM_HIGH_RISK_SOURCE',claimId:claim.id,type:claim.type});
    }
  }
  return failures;
}
export function missingRequiredModules(article,required){
  const covered=new Set((article?.sections??[]).flatMap(s=>s.modules??[]));
  return required.filter(module=>!covered.has(module));
}
export function validateDraftArticle(article,required,evidence){
  const failures=[];
  if(!article?.plan?.primaryQuestion||!article?.plan?.readerSituation||!Array.isArray(article?.plan?.nextActions)||!article.plan.nextActions.length)failures.push({code:'PLAN_REQUIRED'});
  const ids=new Set();
  for(const section of article?.sections??[]){
    if(ids.has(section.id))failures.push({code:'SECTION_ID',sectionId:section.id});ids.add(section.id);
    const body=norm((section.paragraphs??[]).join(' '));
    if(!body.includes(norm(section.highlightPhrase)))failures.push({code:'HIGHLIGHT_NOT_IN_BODY',sectionId:section.id});
    if(section.underlinePhrase?.trim()&&!body.includes(norm(section.underlinePhrase)))failures.push({code:'UNDERLINE_NOT_IN_BODY',sectionId:section.id});
    if(norm(section.highlightPhrase)===norm(section.underlinePhrase)&&section.underlinePhrase?.trim())failures.push({code:'EMPHASIS_DUPLICATE',sectionId:section.id});
  }
  for(const module of missingRequiredModules(article,required))failures.push({code:'MISSING_CORE_MODULE',module});
  failures.push(...duplicateFailures(article),...claimFailures(article,evidence));
  return failures;
}
export function visibleCharacterCount(article){
  const parts=[article?.lead,article?.summary,...(article?.sections??[]).flatMap(s=>[s.heading,s.strongPoint,...(s.paragraphs??[])])];
  return Array.from(parts.map(norm).filter(Boolean).join(' ')).length;
}
export function buildLengthReport(article,scope){
  const [min,max]=lengthBandForScope(scope),visibleCharacters=visibleCharacterCount(article);
  const status=visibleCharacters<min?'low':visibleCharacters>max?'high':'in-band';
  return {
    scope,recommendedBand:[min,max],visibleCharacters,status,
    sectionCount:article?.sections?.length??0,
    duplicateCandidates:duplicateFailures(article),
    includedModules:[...new Set((article?.sections??[]).flatMap(s=>s.modules??[]))],
  };
}

async function generateArticle(item,evidence,extensions,required,scope,currentTitle,{model,fetcher}){
  const [min,max]=lengthBandForScope(scope);
  return ollamaJson([
    {role:'system',content:`한국어 건강정보 블로그 작성자다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이며 다른 대상으로 재해석하지 않는다. 검색 범위는 ${scope}, 권장 표시 본문은 ${min}~${max}자지만 글자 수를 채우려고 문장을 늘리지 않는다. 핵심 질문에 필요한 만큼만 쓰고 충분히 답했으면 끝낸다. 필수 core 모듈은 ${required.join(', ')}이며 반드시 자연스럽게 답한다. 그 밖의 모듈은 검색 의도·직접 근거·새로운 판단 가치가 모두 있을 때만 선택한다. 제공 자료 밖에서 수치·효능·용량·상호작용을 만들지 않는다. 농약·농업·유전학 자료는 그 연구가 실제로 다루는 안전·재배 범위에서만 사용하고 사람의 건강 효능으로 확대하지 않는다. 사람 연구도 대상·형태·용량·기간·평가 결과가 실제 주장과 맞을 때만 사용한다. plan과 article을 한 번에 만든다. claims에는 수치·효능·안전·용량·상호작용·질병 관련 핵심 주장만 기록하고 sourceIds로 근거를 연결한다. strongPoint는 섹션의 짧은 결론이고 paragraphs는 새로운 설명이다. highlightPhrase와 underlinePhrase는 paragraphs 안에 실제로 존재하는 짧은 구절을 그대로 복사한다. underlinePhrase가 필요 없으면 빈 문자열이다. 같은 의미를 strongPoint·paragraph에서 반복하지 않는다. 요약과 마지막 핵심정리의 재언급은 허용한다. 분야 안내: ${DOMAIN_RULES[item.domain].guidance}`},
    {role:'user',content:JSON.stringify({keyword:item.keyword,canonicalEnglishQuery:evidence.query,domain:item.domain,category:item.category,currentUrl:item.targetUrl,currentTitle,scope,lengthBand:[min,max],requiredCoreModules:required,optionalExtensions:extensions,sources:sourceBundle(evidence)})}
  ],schema(required,evidence.sources),{model,fetcher,numPredict:outputBudget(scope)});
}
async function repairArticle(item,evidence,extensions,required,scope,currentTitle,article,failures,{model,fetcher}){
  const [min,max]=lengthBandForScope(scope);
  return ollamaJson([
    {role:'system',content:`기존 초안을 한 번만 교정한다. canonicalSubject는 "${item.keyword} = ${evidence.query}"이다. 실패 항목만 고치되 전체 글을 불필요하게 늘리지 않는다. core 모듈 누락은 실제 근거로 답하고, 근거가 부족하면 확인 가능한 한계를 정확히 설명한다. 선택 모듈은 삭제해도 된다. claims의 sourceIds와 주장 범위를 맞춘다. highlightPhrase·underlinePhrase는 반드시 해당 paragraphs의 실제 구절이어야 한다. 권장 분량 ${min}~${max}자는 경고 범위이지 강제 목표가 아니다. 같은 설명을 반복해서 통과시키지 않는다.`},
    {role:'user',content:JSON.stringify({failures,existingArticle:article,requiredCoreModules:required,scope,currentTitle,extensions,sources:sourceBundle(evidence)})}
  ],schema(required,evidence.sources),{model,fetcher,numPredict:outputBudget(scope)});
}

export async function draftArticle(item,evidence,extensions=conservativeExtensions(item),{model,fetcher=fetch,currentTitle=''}={}){
  const required=requiredModules(item,extensions),scope=inferWritingScope(item,currentTitle);
  let article=await generateArticle(item,evidence,extensions,required,scope,currentTitle,{model,fetcher});
  article.plan={...(article.plan??{}),scope};
  let failures=validateDraftArticle(article,required,evidence);
  if(failures.length){
    article=await repairArticle(item,evidence,extensions,required,scope,currentTitle,article,failures,{model,fetcher});
    article.plan={...(article.plan??{}),scope};
    failures=validateDraftArticle(article,required,evidence);
  }
  if(failures.length)throw Object.assign(new Error('E_QUEUE_DRAFT_VALIDATION'),{details:{failures,required,scope,lengthReport:buildLengthReport(article,scope)}});
  return {article,required,extensions,lengthReport:buildLengthReport(article,scope)};
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
function emphasizeParagraph(text,highlightPhrase,underlinePhrase){
  let out=esc(text),highlight=esc(highlightPhrase),underline=esc(underlinePhrase);
  if(highlight&&out.includes(highlight))out=out.replace(highlight,`<mark data-tone="key">${highlight}</mark>`);
  if(underline&&out.includes(underline)&&!underline.includes(highlight)&&!highlight.includes(underline))out=out.replace(underline,`<u>${underline}</u>`);
  return out;
}
export function renderBody(article,evidence,images){
  const imageTags=images.map(x=>`<p><img src="${esc(x.src)}" alt="${esc(x.alt)}"></p>`);
  let html=imageTags[0]+`\n<p>${esc(article.lead??article.title)}</p>\n<blockquote><strong>핵심만 먼저:</strong> ${esc(article.summary)}</blockquote>`;
  const p1=Math.max(1,Math.floor(article.sections.length/3));
  const p2=Math.max(p1+1,Math.floor(article.sections.length*2/3));
  article.sections.forEach((section,index)=>{
    html+=`\n<h2>${esc(section.heading)}</h2>`;
    const first=emphasizeParagraph(section.paragraphs[0],section.highlightPhrase,section.underlinePhrase);
    const safetyKind=section.modules.includes('red_flags')?'danger':section.modules.includes('contraindications')?'caution':null;
    if(safetyKind)html+=`\n<blockquote data-kind="${safetyKind}"><p><strong>${esc(section.strongPoint)}</strong> ${first}</p></blockquote>`;
    else html+=`\n<p><strong>${esc(section.strongPoint)}</strong> ${first}</p>`;
    for(const p of section.paragraphs.slice(1))html+=`\n<p>${esc(p)}</p>`;
    html+=`\n<p>${section.sourceIds.map(id=>{const s=evidence.sources.find(x=>x.id===id);return `<a href="${esc(s.url)}">${esc(s.title)}</a>`;}).join(' · ')}</p>`;
    if(index===p1-1)html+=`\n${imageTags[1]}`;
    if(index===p2-1)html+=`\n${imageTags[2]}`;
  });
  html+=`\n<h2>핵심 정리</h2><ul>${article.sections.slice(0,7).map(s=>`<li>${esc(s.strongPoint)}</li>`).join('')}</ul>`;
  html+=`\n<h2>자료 출처</h2><ul>${evidence.sources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a> — 자료 확인일 ${s.checkedAt}</li>`).join('')}${attribution(images)}</ul>`;
  return glossaryPass(html);
}
