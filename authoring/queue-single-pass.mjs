import { ollamaJson } from './queue-ollama.mjs';
import { R53_SECTION_SPECS } from './queue-r53.mjs';
import { contentDigest, todayInSeoul } from '../publishing/content-standards.mjs';
import { foodSectionInstructions, writeFoodSections } from './queue-food-sections.mjs';

export const SINGLE_PASS_STANDARD='SP1';
const DETAILS={
  food:[
    '정의·먹는 부위·대표적인 종류·생것과 가공품의 차이를 설명한다.',
    '확보한 영양자료의 100g당 열량·탄수화물·단백질·지방·식이섬유와 주요 성분을 수치·단위로 설명한다. 생것/조리 상태와 기준량을 명시한다.',
    '성분이나 섭취에 관한 연구의 대상·기간·섭취 조건·관찰 결과를 자료가 제공하는 범위에서 설명하고 사람/동물/시험관 연구와 식품/추출물을 구분한다.',
    '함께 먹는 재료와 실제 조리 예시, 영양을 보완하는 이유를 설명한다. 기름·양념·첨가당·조리법이 열량 등에 미치는 조건을 설명한다.',
    '해당 식품에 실제 적용되는 알레르기·주의 대상·섭취 조건을 설명한다. 확인된 양·온도·기간은 단위와 적용 조건을 함께 쓴다.',
    '껍질·색·꼭지·단단함 등 구매 판단 기준과 포장·보관 방법을 설명한다. 자료가 제공한 보관 온도·기간은 신선도와 안전 조건을 구분한다.'
  ],
  nutrient:[
    '성분의 정의·체내 역할·식품과 보충제의 차이를 구체적으로 설명한다.',
    '연구의 대상·기간·용량·결과를 구분하고 한 달 효과는 실제 기간 근거가 있을 때만 설명한다.',
    '확인된 권장량·상한량·연구 용량을 구분하고 연령·대상·단위·섭취 방법을 함께 쓴다.',
    '자료가 있는 식품별 함유량과 기준량·조리 상태를 제시한다. 비교 자료가 없는 순위는 만들지 않는다.',
    '함께 섭취하는 성분의 이유·조건과 실제 약물 상호작용 자료를 구분한다.',
    '결핍·과다 위험·주의 대상을 설명하고 제품은 성분량·제형·선택 기준으로 비교한다.'
  ],
  medicine:[
    '성분·계열·작용과 허가된 목적을 설명한다.',
    '허가 적응증과 연구 효과를 구분하고 대상·기간·결과 수치가 있으면 제시한다.',
    '실제 근거가 있는 병용만 설명하며 보조제의 추가 효과와 위험을 구분한다.',
    '금기·상호작용의 조합과 발생 위험·대처 조건을 구체적으로 설명한다.',
    '주의 대상·부작용·과다복용과 필요한 모니터링을 공식 자료 기준으로 설명한다.',
    '허가 용법·용량·단위·제형·대상 조건을 함께 설명하고 대체약 차이를 구분한다. 개인의 처방 변경 지시는 하지 않는다.'
  ],
  disease:[
    '질환의 정의와 발생 기전을 독자가 이해할 수 있게 설명한다.',
    '원인·위험인자·고위험군을 구분하며 실제 확인된 빈도·위험 수치의 조건을 설명한다.',
    '진단 기준·검사 수치·단위·적용 조건과 감별 필요성을 설명한다.',
    '예방과 식사 패턴의 구체적 실천 예시를 설명하고 식품의 치료 효과로 확대하지 않는다.',
    '표준 치료와 의약품의 역할·대상·효과·근거를 비교한다. 개인 처방을 제안하지 않는다.',
    '재발 예방·추적 검사·관찰 기간과 의료 도움을 받아야 할 증상을 자료 범위에서 설명한다.'
  ]
};
export function writingInstructions(domain) {
  if(domain==='food')return foodSectionInstructions();
  const specs=R53_SECTION_SPECS[domain];
  if(!specs)throw Error('E_QUEUE_PLAN_DOMAIN');
  const sizes=[400,500,450,350,350,250];
  const out=specs.map((s,index)=>({question:s.heading,targetChars:sizes[index],include:DETAILS[domain][index]}));
  if(domain==='nutrient')out[0].question='정의와 주요 성분 및 작용';
  return out;
}
export async function writeSinglePassArticle(item,evidence,{cached=(_stage,_input,action)=>action(),onCacheHit,...options}={}) {
  if(item.domain==='food')return writeFoodSections(item,evidence,{cached,onCacheHit,...options});
  const instructions=writingInstructions(item.domain);
  const format={type:'object',additionalProperties:false,required:['title','lead','summary','sections'],properties:{
    title:{type:'string'},lead:{type:'string'},summary:{type:'string'},
    sections:{type:'array',items:{type:'object',additionalProperties:false,required:['heading','text'],properties:{heading:{type:'string'},text:{type:'string'}}}}
  }};
  const messages=[{role:'system',content:'한국어 블로그 글을 전체 1회 작성한다. 본문 6개 항목 합계 약 2300자, 도입·핵심 요약 포함 약 2500자를 목표로 한다. 제시된 질문 순서와 항목별 목표 글자수는 정보량 안내이며 문장·문단 수는 자유다. 각 include의 구체적인 내용을 충분히 설명한다. 자료에 있는 수치·단위·기준량·대상·기간·조리 상태를 함께 제시하고 독자가 실행할 수 있는 예시와 판단 기준을 쓴다. 일반적인 효능 문장이나 같은 설명을 반복해 분량을 채우지 않는다. 확인되지 않은 수치·효과·순위는 만들어내지 않는다. 자료가 부족한 항목은 숫자를 억지로 채우지 않는다. 전문용어는 쉽게 설명한다. 제목, 도입, 핵심 요약, 절별 heading과 text만 JSON으로 반환한다.'},
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
