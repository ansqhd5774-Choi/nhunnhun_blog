import {assertEditorialSource} from '../publishing/editorial.mjs';
import {plainText} from '../publishing/core.mjs';

// Additional ACTIVE requirements do not grant publication approval.
export function assertActiveSource(source,evidence){
  assertEditorialSource(source);
  const html=source.bodyHtml;
  if(!/<h2>함께 보면 좋은 글<\/h2>/.test(html)||!evidence.internal_links?.length)throw new Error('E_ACTIVE_RELATED_REQUIRED');
  for(const link of evidence.internal_links){
    if(!/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(link.url)||link.relevance_reviewed!==true||!link.relevance_reason?.trim()||!html.includes(link.url))throw new Error('E_ACTIVE_RELATED_REVIEW');
    if(source.targetUrl===link.url)throw new Error('E_ACTIVE_SELF_LINK');
  }
  if(new Set(evidence.sources?.map(s=>s.url)).size<2)throw new Error('E_ACTIVE_EVIDENCE_REQUIRED');
  if(!/<h2>최신 근거\s*·\s*\d{4}<\/h2>/.test(html))throw new Error('E_ACTIVE_LATEST_REQUIRED');
  const highlights=[...html.matchAll(/<u>([\s\S]*?)<\/u>/g)].map(m=>plainText(m[1]));
  if(highlights.some(t=>!t.trim()||t.length>30||/[。!?]|\.(?:\s|$)/.test(t)))throw new Error('E_ACTIVE_HIGHLIGHT_PHRASE');
  if((html.match(/<p><strong>Q\. /g)||[]).length<2)throw new Error('E_ACTIVE_FAQ_REQUIRED');
  return source;
}

export function highlightPhrase(text){
  // Pick an exact, short factual quantity or known handling term, never slice a sentence.
  const phrase=text.match(/\d+(?:\.\d+)?\s*(?:kcal|g|초)(?![a-zA-Z])/i)?.[0]
    ??['흐르는 물','이미 자른 농산물','식이섬유','기준량','손 씻기','열량','손상'].find(p=>text.includes(p));
  return phrase??null;
}

export function reviewedNutritionRows(evidence){
  const claims=evidence.sources.flatMap(s=>s.claims);
  const portion=claims.find(c=>c.id==='c-portion'),energy=claims.find(c=>c.id==='c-calories'),fiber=claims.find(c=>c.id==='c-fiber');
  if(!portion||!energy||!fiber)return [];
  const grams=portion.text.match(/(?:부분|기준량)\s*(\d+(?:\.\d+)?)\s*g/)?.[1];
  const calories=energy.text.match(/열량은\s*(\d+(?:\.\d+)?)\s*kcal/)?.[1];
  const fiberGrams=fiber.text.match(/식이섬유는\s*(\d+(?:\.\d+)?)\s*g/)?.[1];
  if(!grams||!calories||!fiberGrams||!energy.text.includes(grams+' g')||!fiber.text.includes(grams+' g'))throw new Error('E_ACTIVE_NUTRITION_BASIS');
  return [{label:'먹을 수 있는 부분의 기준량',value:grams,unit:'g'},{label:'해당 기준량의 열량',value:calories,unit:'kcal'},{label:'해당 기준량의 식이섬유',value:fiberGrams,unit:'g'}];
}
