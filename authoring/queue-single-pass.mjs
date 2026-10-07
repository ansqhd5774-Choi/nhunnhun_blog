import { ollamaJson } from './queue-ollama.mjs';
import { R53_SECTION_SPECS } from './queue-r53.mjs';
import { contentDigest, todayInSeoul } from '../publishing/content-standards.mjs';

export const SINGLE_PASS_STANDARD='SP1';
export function writingInstructions(domain) {
  const specs=R53_SECTION_SPECS[domain];
  if(!specs)throw Error('E_QUEUE_PLAN_DOMAIN');
  const out=specs.map(s=>({question:s.heading,targetChars:s.targetChars}));
  if(domain==='nutrient')out[0].question='정의와 주요 성분 및 작용';
  return out;
}
export async function writeSinglePassArticle(item,evidence,{cached=(_stage,_input,action)=>action(),onCacheHit,...options}={}) {
  const instructions=writingInstructions(item.domain);
  const format={type:'object',additionalProperties:false,required:['title','lead','summary','sections'],properties:{
    title:{type:'string'},lead:{type:'string'},summary:{type:'string'},
    sections:{type:'array',items:{type:'object',additionalProperties:false,required:['heading','text'],properties:{heading:{type:'string'},text:{type:'string'}}}}
  }};
  const messages=[{role:'system',content:'한국어 블로그 글을 전체 1회 작성한다. 제시된 질문 순서와 항목별 목표 글자수는 정보량 안내이며 문장·문단 수는 자유다. 자료를 활용하고 확인되지 않은 수치·효과·순위는 만들어내지 말고 확인 한계를 설명한다. 전문용어는 쉽게 설명한다. 제목, 도입, 핵심 요약, 절별 heading과 text만 JSON으로 반환한다.'},
    {role:'user',content:JSON.stringify({keyword:item.keyword,canonicalSubject:evidence.query,domain:item.domain,instructions,sources:evidence.sources.slice(0,8).map(s=>({title:s.title,url:s.url,text:String(s.notes??'').slice(0,1400)}))})}];
  const raw=await cached('single-draft',{messages,format,model:options.model},()=>ollamaJson(messages,format,{...options,purpose:'draft',numCtx:12288,numPredict:5200}),onCacheHit);
  if(![raw.title,raw.lead,raw.summary].every(x=>typeof x==='string'&&x.trim())||!Array.isArray(raw.sections)||raw.sections.length<4
    ||raw.sections.some(s=>typeof s.heading!=='string'||!s.heading.trim()||typeof s.text!=='string'||!s.text.trim()))throw Error('E_QUEUE_DRAFT_SCHEMA');
  return {title:raw.title.trim(),lead:raw.lead.trim(),summary:raw.summary.trim(),
    sections:raw.sections.map((s,index)=>({id:`section-${index}`,heading:s.heading.trim(),paragraphs:s.text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean),modules:[],sourceIds:[],strongPhrase:s.text.slice(0,70)})),
    plan:{scope:'single-pass'}};
}
export function singlePassReceipt(source,item,evidence) {
  return {version:SINGLE_PASS_STANDARD,domain:item.domain,sourceDigest:contentDigest(source),generatedAt:todayInSeoul(),
    policy:'single-write-auto-publish-user-content-review',semanticReview:'not-performed',
    instructions:writingInstructions(item.domain),sources:evidence.sources.map(s=>({title:s.title,url:s.url})),notes:[]};
}
