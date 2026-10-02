import fs from 'node:fs';

const html=fs.readFileSync('skin/reference/skin.html','utf8');
const css=fs.readFileSync('css/reference/style.css','utf8');

function count(re,s){return (s.match(re)||[]).length}
function assert(cond,msg){if(!cond) throw new Error(msg)}

assert(count(/<head>/gi,html)===1,'E_HEAD_OPEN');
assert(count(/<\/head>/gi,html)===1,'E_HEAD_CLOSE');
assert(count(/<meta\s+charset=["']utf-8["']/gi,html)===1,'E_CHARSET');
assert(!html.includes('<meta name="title" content="[##_page_title_##]"'),'E_GENERIC_META_TITLE');
assert(!html.includes('<meta name="description" content="[##_desc_##]"'),'E_GENERIC_META_DESC');
assert(html.includes('max-image-preview:large'),'E_ROBOTS_PREVIEW');
assert(!html.includes('dns-preferch'),'E_DNS_PREFETCH_TYPO');
assert(!html.includes('toyou101.tistory.com'),'E_OLD_FOOTER_LINK');
assert(!html.includes('Designed by'),'E_OLD_DESIGNER');
assert(count(/id=["']search-input["'][^>]*aria-label=["']검색어 입력["']/gi,html)===1,'E_SEARCH_ARIA');
assert(html.includes('<p class="post_text">[##_article_rep_summary_##]</p>'),'E_SUMMARY_P_CLOSE');
assert(!html.includes('<ui id="duplicateWordsContainer">'),'E_INVALID_UI_TAG');

for(const text of ['format_list_bulleted','textsms','navigate_before','navigate_next','fullscreen','fullscreen_exit']){
  assert(!new RegExp('>'+text+'<','i').test(html),'E_CRAWLER_LIGATURE_'+text);
}

assert(!html.includes('css2?family=[##_var_mainFont_##]'),'E_MAINFONT_GOOGLE');
assert(!html.includes('rel="preload" as="style" href="https://fonts.googleapis.com/css?family=Material+Icons+Outlined'),'E_ICON_PRELOAD');
assert(html.includes('media="print" onload="this.media=\'all\'"'),'E_ICON_ASYNC');

for(const marker of [
  'ZG performance stability R1B',
  'ZG CLS async widgets R3',
  'ZG CLS reserve R2',
  'BLOG A11Y R1',
  'BLOG CRAWL UI R1',
  'BLOG HEADER A11Y R2'
]) assert(css.includes(marker),'E_CSS_MARKER_'+marker);

console.log(JSON.stringify({
  status:'PASS',
  htmlBytes:Buffer.byteLength(html),
  cssBytes:Buffer.byteLength(css),
  checks:{
    head:1,
    charset:1,
    robots:true,
    searchAria:true,
    crawlerLigatures:0,
    footerLegacy:false
  }
},null,2));
