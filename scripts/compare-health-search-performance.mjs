import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const days = ([start,end]) => {
  const a=Date.parse(start),b=Date.parse(end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<a) throw new Error('INVALID_COMPARISON_PERIOD');
  return (b-a)/86400000+1;
};
export function comparePerformance(input) {
  if(days(input.current)!==days(input.previous)) throw new Error('UNEQUAL_COMPARISON_PERIODS');
  if(input.previous[1]>=input.current[0]) throw new Error('OVERLAPPING_COMPARISON_PERIODS');
  const rows=input.rows.filter(row=>/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(row.url)).map(row=>{
    for(const field of ['currentClicks','previousClicks','currentImpressions','previousImpressions']) {
      if(!Number.isFinite(row[field])||row[field]<0) throw new Error('INVALID_SEARCH_METRIC');
    }
    const rate=(clicks,impressions)=>impressions?clicks/impressions:null;
    return {...row,currentCtr:rate(row.currentClicks,row.currentImpressions),previousCtr:rate(row.previousClicks,row.previousImpressions),
      action:row.currentImpressions>=20&&row.currentClicks===0?'REVIEW_SEARCH_INTENT':row.currentImpressions>=20?'CHECK_CURRENT_CONTENT_BEFORE_CHANGE':'LOW_SAMPLE_KEEP',
      implementationEffect:'NOT_ESTABLISHED'};
  }).sort((a,b)=>b.currentImpressions-a.currentImpressions);
  return {checkedAt:input.checkedAt,current:input.current,previous:input.previous,searchType:input.searchType,
    rows,excludedRows:input.rows.length-rows.length,
    limitation:'Official provider observations; fragment and non-article rows are separate. No causal effect or future traffic is inferred.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw new Error('USAGE: input.json output.json');
  const result=comparePerformance(JSON.parse(await fs.readFile(input,'utf8')));
  await fs.writeFile(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({articleRows:result.rows.length,excludedRows:result.excludedRows,reviewCandidates:result.rows.filter(r=>r.action==='REVIEW_SEARCH_INTENT').map(r=>r.url)}));
}
