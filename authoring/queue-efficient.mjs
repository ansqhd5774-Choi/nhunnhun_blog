import { buildCoreSkeleton, selectPlanSources, deterministicClaimType, deterministicClaimRisk } from './queue-plan.mjs';
import { DOMAIN_RULES } from '../publishing/content-standards.mjs';
import { ollamaJson } from './queue-ollama.mjs';

const norm = value => String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const HIGH_RISK = /질병|예방|치료|복용량|용량|상호작용|금기|임신|수유|응급|부작용|권장량|상한/u;
const bounded = sources => sources.map(s => ({ id:s.id, title:s.title, kind:s.kind, role:s.role,
  topicSpecific:s.topicSpecific === true, scopeNote:s.scopeNote, facts:String(s.notes ?? '').slice(0, 1400) }));

export function buildWritingContract(item, evidence) {
  const rules = DOMAIN_RULES[item.domain];
  if (!rules) throw Error('E_QUEUE_PLAN_DOMAIN');
  const sources = selectPlanSources(evidence, item, 7).filter(s => norm(s.notes).length >= 40);
  const strong = sources.filter(s => ['official','guideline','trial','systematic-review','nutrition-database'].includes(s.kind)
    && ['health','safety','nutrition','authorization'].includes(s.role));
  if (new Set(strong.map(s => s.url)).size < 2) throw Error('E_QUEUE_PLAN_EVIDENCE');
  if (item.domain === 'medicine' && !sources.some(s => s.kind === 'official' && s.role === 'authorization'
    && /(^|\.)mfds\.go\.kr$/.test(new URL(s.url).hostname))) throw Error('E_QUEUE_KR_AUTHORIZATION_MISSING');
  if (item.domain === 'disease' && !sources.some(s => ['official','guideline'].includes(s.kind) && s.role === 'health'))
    throw Error('E_QUEUE_DISEASE_PRIMARY_SOURCE');
  const sections = buildCoreSkeleton(item).map(section => {
    const roles=section.modules.includes('nutrition')?['nutrition']
      :section.modules.some(m=>['safety','storage','preparation','contraindications','interactions','red_flags','medical_help'].includes(m))?['safety','authorization','health']
      :section.modules.some(m=>['benefits','treatment','indications','amount','timeline','diagnosis'].includes(m))?['health','authorization','nutrition']
      :['nutrition','authorization','health','safety'];
    const sectionSources=sources.filter(s=>roles.includes(s.role));
    return { ...section, sourceIds:sectionSources.map(s => s.id), facts:sectionSources.map(s => String(s.notes ?? "").slice(0,1400)),
      instruction:'자료에 없는 효과·수치·기간을 만들지 않는다. 일반 안내는 적용 범위를 밝힌다. 필수 의료 안전자료 부족은 중단한다.' };
  });
  const covered = new Set(sections.flatMap(s => s.modules));
  if (rules.core.some(module => !covered.has(module))) throw Error('E_QUEUE_PLAN_CORE');
  return { version:'R5.4', domain:item.domain, keyword:item.keyword, required:[...rules.core], sections,
    sources:bounded(sources), guidance:rules.guidance,
    primaryQuestion:`${item.keyword}의 의미, 기대할 수 있는 범위와 실제 선택·사용·주의사항은 무엇인가?`,
    readerSituation:`${item.keyword}를 알아보고 근거에 맞는 선택과 다음 행동을 결정하려는 독자다.`,
    nextActions:[`${item.keyword}의 적용 조건과 주의사항을 확인한 뒤 자신의 상황에 맞는 선택을 한다.`] };
}

function sectionSchema(ids,sourceIds,modules) {
  return { type:'object', additionalProperties:false, required:['id','paragraphs','sourceIds','answers'], properties:{
    id:{type:'string',enum:ids}, paragraphs:{type:'array',minItems:1,maxItems:4,items:{type:'string',minLength:30}},
    sourceIds:{type:'array',minItems:1,items:{type:'string',enum:sourceIds}},
    answers:{type:'array',minItems:1,items:{type:'object',additionalProperties:false,required:['module','quote'],properties:{module:{type:'string',enum:modules},quote:{type:'string',minLength:20,maxLength:240}}}}
  } };
}
function schema(contract, patch = false) {
  const properties = {sections:{type:'array',minItems:1,maxItems:contract.sections.length,
    items:sectionSchema(contract.sections.map(s => s.id),contract.sources.map(s=>s.id),contract.sections.flatMap(s=>s.modules))}};
  if (!patch) Object.assign(properties, {title:{type:'string',minLength:8},lead:{type:'string',minLength:30},summary:{type:'string',minLength:30}});
  return {type:'object',additionalProperties:false,required:Object.keys(properties),properties};
}

export function draftIssues(raw, contract) {
  const issues = [], seen = new Set(), prose = new Map(), expected = new Set(contract.sections.map(s => s.id));
  for (const section of raw.sections ?? []) {
    if (!expected.has(section.id) || seen.has(section.id)) throw Error('E_QUEUE_DRAFT_SECTION_ID');
    seen.add(section.id);
    if (!Array.isArray(section.paragraphs) || !section.paragraphs.length || section.paragraphs.some(p => norm(p).length < 30))
      issues.push({sectionId:section.id,code:'SECTION_EMPTY'});
    if (!Array.isArray(section.sourceIds) || !section.sourceIds.length || section.sourceIds.some(id => !contract.sources.some(s => s.id === id)))
      issues.push({sectionId:section.id,code:'SOURCE_IDS'});
    const proseText=(section.paragraphs??[]).join(' ');
    const spec=contract.sections.find(s=>s.id===section.id);
    if(!Array.isArray(section.answers)||spec.modules.some(module=>!section.answers.some(a=>a.module===module&&norm(a.quote).length>=20&&proseText.includes(norm(a.quote))))
      ||section.answers.some(a=>!spec.modules.includes(a.module))||new Set(section.answers.map(a=>a.module)).size!==section.answers.length)
      issues.push({sectionId:section.id,code:'MODULE_ANSWER'});
    if(!Array.isArray(section.anchors)||section.anchors.length!==4||new Set(section.anchors).size!==4
      ||section.anchors.some(a=>norm(a).length<2||norm(a).length>35||!proseText.includes(a))
      ||section.anchors.some((a,i)=>section.anchors.some((b,j)=>i!==j&&a.includes(b))))
      issues.push({sectionId:section.id,code:'SCAN_ANCHORS'});
    for (const paragraph of section.paragraphs ?? []) {
      const text = norm(paragraph);
      if (text.length > 50 && prose.has(text)) issues.push({sectionId:section.id,code:'DUPLICATE_PROSE'});
      prose.set(text,section.id);
    }
  }
  for (const section of contract.sections) if (!seen.has(section.id)) issues.push({sectionId:section.id,code:'SECTION_MISSING'});
  return issues;
}

export function assembleDraft(raw, contract) {
  if (norm(raw.title).length < 8 || norm(raw.lead).length < 30 || norm(raw.summary).length < 30) throw Error('E_QUEUE_DRAFT_HEADER');
  const issues = draftIssues(raw, contract);
  if (issues.length) throw Object.assign(Error('E_QUEUE_DRAFT_VALIDATION'), {details:issues});
  const sections = contract.sections.map(spec => {
    const written = raw.sections.find(s => s.id === spec.id), paragraphs = written.paragraphs.map(norm);
    return {...spec,paragraphs,sourceIds:written.sourceIds,strongPhrase:paragraphs[0].slice(0,70),anchors:written.anchors,answers:written.answers};
  });
  const claims = sections.flatMap(section => section.paragraphs.flatMap((text,index) => {
    const type = deterministicClaimType(text);
    return [{id:`${section.id}-${index}`,sectionId:section.id,text,type,
      risk:HIGH_RISK.test(text)?'high':deterministicClaimRisk(type,text),sourceIds:section.sourceIds}];
  }));
  // Title/lead/summary are included in the reviewer input as well as prose claims.
  return {title:norm(raw.title),lead:norm(raw.lead),summary:norm(raw.summary),sections,claims,
    plan:{scope:'evidence-first',primaryQuestion:contract.primaryQuestion,readerSituation:contract.readerSituation,nextActions:contract.nextActions}};
}

export async function patchDraft(raw, contract, issues, options = {}) {
  const ids = new Set(issues.map(i => i.sectionId));
  if (!ids.size || [...ids].some(id => !contract.sections.some(s => s.id === id))) throw Error('E_QUEUE_PATCH_SCOPE');
  const subset = {...contract,sections:contract.sections.filter(s => ids.has(s.id))};
  const sourceIds = new Set(subset.sections.flatMap(s => s.sourceIds));
  subset.sources = subset.sources.filter(s => sourceIds.has(s.id));
  const patch = await call('patch', [
    {role:'system',content:'한국어 건강 글의 지정된 절만 보완한다. 오류 설명과 근거 범위에 맞게 고친다. MODULE_ANSWER는 contract의 각 필수 module 질문에 실제 답하는 문장을 본문에 작성하고 answers에 해당 문장의 연속된 구절을 그대로 복사하라는 뜻이다. SOURCE_IDS는 제공된 contract.sources의 실제 id 중 사용한 것만 선택한다. DUPLICATE_PROSE는 다른 절과 같은 문장을 반복하지 말라는 뜻이다. 다른 절과 제목은 수정하지 않는다. JSON만 출력한다.'},
    {role:'user',content:JSON.stringify({contract:subset,issues,sections:(raw.sections ?? []).filter(s => ids.has(s.id))})}
  ], schema(subset,true), {...options,numPredict:Math.min(3000,900*ids.size)});
  if (patch.sections?.length !== ids.size || new Set(patch.sections.map(s => s.id)).size !== ids.size
    || patch.sections.some(s => !ids.has(s.id))) throw Error('E_QUEUE_PATCH_SCOPE');
  const anchored=await attachAnchors(patch,options);
  return {...raw,sections:contract.sections.map(s => anchored.sections.find(p => p.id === s.id) ?? raw.sections.find(p => p.id === s.id)).filter(Boolean)};
}

export function anchorCandidates(section) {
  const candidates=[];
  for(const paragraph of section.paragraphs??[]){
    // Non-overlapping, exact excerpts; the model chooses importance without rewriting them.
    for(const match of norm(paragraph).matchAll(/\S+(?:\s+\S+){0,2}/g)){
      const text=match[0];
      if(text.length>=2&&text.length<=35&&!candidates.some(c=>c.text===text||c.text.includes(text)||text.includes(c.text)))
        candidates.push({id:'q'+candidates.length,text});
    }
  }
  return candidates;
}

async function attachAnchors(raw,options) {
  const sections=(raw.sections??[]).filter(s=>{
    const text=(s.paragraphs??[]).join(' ');
    return !Array.isArray(s.anchors)||s.anchors.length!==4||s.anchors.some(a=>!text.includes(a)||a.length>35)
      ||s.anchors.some((a,i)=>s.anchors.some((b,j)=>i!==j&&a.includes(b)));
  });
  if(!sections.length)return raw;
  const choices=sections.map(s=>({sectionId:s.id,candidates:anchorCandidates(s)}));
  if(choices.some(s=>s.candidates.length<4))throw Error('E_QUEUE_ANCHOR_CANDIDATES');
  const properties=Object.fromEntries(choices.map(s=>[s.sectionId,{type:'array',minItems:4,maxItems:4,items:{type:'string',enum:s.candidates.map(c=>c.id)}}]));
  const format={type:'object',additionalProperties:false,required:Object.keys(properties),properties};
  const selected=await call('anchors',[
    {role:'system',content:'건강 글의 시각 강조 위치를 고른다. 각 절의 candidates 중 핵심 사실·기억할 점·조건 차이·실제 행동을 잘 드러내는 서로 다른 id 4개만 선택한다. 본문과 구절을 다시 쓰지 않는다. JSON만 출력한다.'},
    {role:'user',content:JSON.stringify(choices)}
  ],format,{...options,numPredict:700,numCtx:12288});
  return {...raw,sections:raw.sections.map(section=>{
    const pool=choices.find(c=>c.sectionId===section.id);if(!pool)return section;
    const ids=selected[section.id];
    if(!Array.isArray(ids)||ids.length!==4||new Set(ids).size!==4||ids.some(id=>!pool.candidates.some(c=>c.id===id)))throw Error('E_QUEUE_SCAN_SELECTION');
    return {...section,anchors:ids.map(id=>pool.candidates.find(c=>c.id===id).text)};
  })};
}

async function call(stage,messages,format,options) {
  const {cached = (_stage,_input,action) => action(),onCacheHit, ...request} = options;
  const numCtx=request.numCtx??12288;
  return cached(stage,{messages,format,model:request.model,numPredict:request.numPredict,numCtx},
    () => ollamaJson(messages,format,{...request,numCtx,purpose:stage}),onCacheHit);
}

export async function writeEfficientArticle(contract, {currentTitle='',internalLinks=[],...options} = {}) {
  let raw = await call('draft', [
    {role:'system',content:'한국어 건강 글을 작성한다. 각 절의 modules마다 질문에 답하는 문장을 본문에 쓰고 answers에 module과 실제 답변 문장의 연속된 구절을 그대로 복사한다. answers는 문단 제목이나 편집 메모가 아니다. contract의 모든 절을 같은 순서로 작성하되 분량을 채우기 위해 반복하지 않는다. 독자가 질문에 답하고 행동할 수 있게 필요한 조건·이유·한계를 충분히 설명한다. 제공된 근거 밖의 수치·효능·권장량·시간표·순위를 만들지 않는다. 일반 자료를 주제별 임상 효과로 확대하지 않는다. 주제 정체를 유지하고 식품/보충제, 사람/동물/시험관 연구를 구분한다. sourceIds는 실제로 사용한 자료의 정확한 id만 적고 모든 id를 나열하지 않는다. 전문용어는 쉬운 뜻을 바로 설명한다. HTML과 강조는 코드가 처리한다. JSON만 출력한다.'},
    {role:'user',content:JSON.stringify({contract,currentTitle,internalLinks:internalLinks.map(({label,url}) => ({label,url}))})}
  ],schema(contract),{...options,numPredict:5200});
  raw=await attachAnchors(raw,options);
  const issues = draftIssues(raw,contract);
  let repaired = false;
  if (issues.length) { raw = await patchDraft(raw,contract,issues,options); repaired = true; }
  return {article:assembleDraft(raw,contract),raw,repaired};
}
