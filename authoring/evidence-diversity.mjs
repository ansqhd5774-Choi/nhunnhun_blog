// Evidence ranking is for research selection, never a substitute for checking individual claims.
// Composition databases can support nutrient quantities but cannot establish human health benefits.
export function isUsdaSource(source){
  const value=`${source?.url??''} ${source?.id??''}`.toLowerCase();
  return /(?:^|[./-])usda(?:[./-]|$)|fdc\.nal\.usda\.gov|api\.nal\.usda\.gov/.test(value);
}
export function isHumanOutcomeSource(source){
  return source?.role==='health'&&source?.topicSpecific===true
    &&['trial','systematic-review','guideline','official'].includes(source?.kind)
    &&!isUsdaSource(source);
}
export function rankEvidenceSource(source){
  const topic=source?.topicSpecific===true;
  let score=topic?40:0;
  if(isHumanOutcomeSource(source))score+=60;
  else if(source?.role==='health'&&topic)score+=28;
  else if(source?.role==='safety'&&topic)score+=22;
  else if(source?.role==='safety')score+=6;
  else if(source?.role==='nutrition')score+=4;
  if(source?.role==='nutrition'&&isUsdaSource(source))score-=25;
  return score;
}
export function selectDiverseEvidenceSources(input,{limit=10}={}){
  if(!Number.isInteger(limit)||limit<1)throw new TypeError('E_EVIDENCE_SELECTION_LIMIT');
  const uniq=new Map();
  for(const source of input??[]){
    const key=String(source?.url??source?.id??'').trim();
    if(key&&!uniq.has(key))uniq.set(key,source);
  }
  const ranked=[...uniq.values()].sort((a,b)=>rankEvidenceSource(b)-rankEvidenceSource(a));
  const chosen=[],taken=new Set();
  const take=src=>{
    if(src&&chosen.length<limit){
      const key=String(src.url??src.id);
      if(!taken.has(key)){taken.add(key);chosen.push(src);}
    }
  };
  // Secure the article's reader-facing answers before any food composition source.
  ranked.filter(isHumanOutcomeSource).slice(0,3).forEach(take);
  take(ranked.find(s=>s.role==='health'&&s.topicSpecific===true));
  take(ranked.find(s=>s.role==='safety'&&s.topicSpecific===true));
  // Food composition is useful for food tables; reserve at most one early slot.
  take(ranked.find(s=>s.role==='nutrition'&&!isUsdaSource(s)));
  take(ranked.find(s=>s.role==='nutrition'));
  ranked.forEach(take);
  return chosen;
}
