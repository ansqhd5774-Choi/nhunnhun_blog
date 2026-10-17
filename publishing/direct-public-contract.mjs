import {renderDirectArticle} from './direct-design.mjs';

function expectedPairItems(sourceHtml){
  const sections=String(sourceHtml).split(/(?=<h2>)/g);
  return sections.reduce((sum,section)=>{
    const title=section.match(/^<h2>([\s\S]*?)<\/h2>/)?.[1]??'';
    if(!/(함께\s*섭취|궁합|상호작용|병용)/u.test(title))return sum;
    return sum+(section.match(/<li>/g)||[]).length;
  },0);
}
function expectedMarkedPairItems(sourceHtml){
  const sections=String(sourceHtml).split(/(?=<h2>)/g);
  return sections.reduce((sum,section)=>{
    const title=section.match(/^<h2>([\s\S]*?)<\/h2>/)?.[1]??'';
    if(!/(함께\s*섭취|궁합|상호작용|병용)/u.test(title))return sum;
    return sum+[...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].filter(m=>/<mark\b/.test(m[1])).length;
  },0);
}
export function directPublicExpectations(sourceHtml) {
  const html=renderDirectArticle(sourceHtml);
  const count=re=>(html.match(re)||[]).length;
  return {roots:1,h2:count(/<h2\b/g),numbers:count(/<small>/g),h3:count(/<h3>/g),
    tables:count(/<table>/g),tableWraps:count(/class="table-scroll"/g),images:count(/<img\b/g),
    marks:count(/<mark\b[^>]*>/g),boldMarks:count(/<mark\b[^>]*>(?:<u>)?<strong>/g),underlinedMarks:count(/<mark\b[^>]*><u><strong>/g),
    badges:count(/class="badge"/g),pairsArticles:expectedPairItems(sourceHtml),pairsMarkedArticles:expectedMarkedPairItems(sourceHtml)};
}
export function assertDirectPublicSnapshot(actual,sourceHtml) {
  const expected=directPublicExpectations(sourceHtml);
  for(const [key,value] of Object.entries(expected)) {
    if(actual[key]!==value)throw Error('E_DIRECT_PUBLIC_'+key.toUpperCase());
  }
  if(actual.stylesVisible!==true)throw Error('E_DIRECT_PUBLIC_STYLE');
}
