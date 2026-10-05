import {FOOD_CATALOG} from './discovery.mjs';import {publicReader} from './research.mjs';import {plainText} from '../publishing/core.mjs';
import {publicArticleTitle} from './article-title.mjs';
const fruitNames=Object.keys(FOOD_CATALOG),intent=/영양|칼로리|식이섬유|보관|세척|선택/;
export function relatedCandidates(topic,entries,excludeUrl=null){
  if(!fruitNames.some(k=>topic.includes(k)))return [];
  const seen=new Set();
  return entries.filter(e=>{
    if(!/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(e.url??'')||e.url===excludeUrl||seen.has(e.url)||!fruitNames.some(k=>e.title.includes(k))||!intent.test(e.title))return false;
    seen.add(e.url);return true;
  }).slice(0,6);
}
export async function reviewedRelatedLinks(topic,inventory,{signal,read=publicReader({signal}),excludeUrl=null}={}){
  const links=[],attempts=[];
  for(const candidate of relatedCandidates(topic,inventory.entries,excludeUrl)){
    try{
      const response=await read(candidate.url,2*1024*1024),text=plainText(response.bytes.toString('utf8'));
      if(response.url!==candidate.url||publicArticleTitle(response.bytes.toString('utf8'))!==candidate.title.replace(/\s+/g,' ').trim())throw new Error('E_INTERNAL_LINK_TITLE');
      links.push({url:candidate.url,title:candidate.title,relevance_reviewed:true,relevance_reason:'같은 과일 식재료 그룹에서 영양 기준이나 선택·세척·보관을 비교해 읽는 관련 자료다. 검색 성과 또는 중복 의도를 입증하지 않는다.',review_method:'CURATED_FRUIT_GROUP_AND_PRACTICAL_INFORMATION_RULE; HTTP_CURRENT_TITLE_CONFIRMED'});
      attempts.push({url:candidate.url,status:'PASS'});if(links.length===2)break;
    }catch(error){attempts.push({url:candidate.url,status:'HOLD',code:/^(E|BLOCKED)_[A-Z0-9_]+$/.test(error.message)?error.message:'E_RELATED_FETCH'});}
  }
  return {links,attempts,search_intent_review:'PENDING_GSC_AND_FULL_INTENT_REVIEW'};
}
