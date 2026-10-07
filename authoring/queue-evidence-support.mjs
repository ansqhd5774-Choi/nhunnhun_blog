const normalized=value=>String(value??'').normalize('NFC').replace(/\s+/g,' ').trim();

export function validateClaimSupport(article,evidence,support){
  const issues=[];
  for(const claim of article.claims??[]){
    const valid=(support??[]).filter(entry=>{
      const cited=evidence.sources.find(s=>s.id===entry.sourceId);
      return entry.claimId===claim.id&&entry.status==='pass'&&claim.sourceIds.includes(entry.sourceId)&&cited
        &&normalized(entry.quote).length>=20&&normalized(String(cited.notes??'').slice(0,1800)).includes(normalized(entry.quote));
    });
    // A quote proves provenance, not semantic entailment; the actual AI review is also required.
    const numbers=claim.text.match(/\d+(?:\.\d+)?/g)??[];
    if(!valid.length||numbers.some(number=>!valid.some(entry=>(entry.quote.match(/\d+(?:\.\d+)?/g)??[]).includes(number))))
      issues.push({sectionId:claim.sectionId,reason:'문단에 연결한 출처에서 실제 근거 구절과 수치의 일치를 확인하지 못했다.',claimId:claim.id});
  }
  if((support??[]).some(s=>!(article.claims??[]).some(c=>c.id===s.claimId)))throw Error('E_QUEUE_REVIEW_UNKNOWN_CLAIM');
  return issues;
}
