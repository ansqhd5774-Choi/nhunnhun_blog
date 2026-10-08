import {renderDirectArticle} from './direct-design.mjs';

export function directPublicExpectations(sourceHtml) {
  const html=renderDirectArticle(sourceHtml);
  const count=re=>(html.match(re)||[]).length;
  return {roots:1,h2:count(/<h2\b/g),numbers:count(/<small>/g),h3:count(/<h3>/g),
    tables:count(/<table>/g),tableWraps:count(/class="table-scroll"/g),images:count(/<img\b/g),
    marks:count(/<mark>/g),boldMarks:count(/<mark>(?:<u>)?<strong>/g),underlinedMarks:count(/<mark><u><strong>/g),
    badges:count(/class="badge"/g)};
}
export function assertDirectPublicSnapshot(actual,sourceHtml) {
  const expected=directPublicExpectations(sourceHtml);
  for(const [key,value] of Object.entries(expected)) {
    if(actual[key]!==value)throw Error('E_DIRECT_PUBLIC_'+key.toUpperCase());
  }
  if(actual.stylesVisible!==true)throw Error('E_DIRECT_PUBLIC_STYLE');
}
