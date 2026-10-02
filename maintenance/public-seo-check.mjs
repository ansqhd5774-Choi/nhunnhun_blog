const BASE='https://nhunnhun.tistory.com';

async function get(path){
  const r=await fetch(BASE+path,{headers:{'user-agent':'nhunnhun-audit/1.0'}});
  const text=await r.text();
  return {status:r.status,text,headers:Object.fromEntries(r.headers.entries())};
}
function assert(c,m){if(!c) throw new Error(m)}
function meta(html,name,prop=false){
  const attr=prop?'property':'name';
  const tags=html.match(/<meta\\b[^>]*>/gi)||[];
  for(const tag of tags){
    const key=tag.match(new RegExp(attr+'=["\\\']([^"\\\']+)["\\\']','i'))?.[1];
    if(key!==name) continue;
    return tag.match(/content=["']([^"']*)["']/i)?.[1]||null;
  }
  return null;
}
function canonical(html){const m=html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)||html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);return m?m[1]:null}
function title(html){const m=html.match(/<title>([\s\S]*?)<\/title>/i);return m?m[1].replace(/<[^>]+>/g,'').trim():null}

const [home,p195,p352,p356,robots,sitemap]=await Promise.all([
  get('/'),get('/195'),get('/352'),get('/356'),get('/robots.txt'),get('/sitemap.xml')
]);
for(const [name,x] of Object.entries({home,p195,p352,p356,robots,sitemap})) assert(x.status===200,'E_HTTP_'+name+'_'+x.status);

assert(title(p195.text)?.includes('사과 품종·고르는 법·보관법·활용법 총정리'),'E_195_TITLE');
assert(p195.text.includes('https://nhunnhun.tistory.com/356'),'E_195_INTERNAL');
assert(p195.text.includes('맛있는 사과 고르는 법'),'E_195_SELECTION');
assert(p195.text.includes('사과 보관법'),'E_195_STORAGE');
assert(!p195.text.includes('사과의 핵심 영양소 효과와 효능 작용 구조는?'),'E_195_OLD_HEALTH');
assert(!p195.text.includes('iryan.kr'),'E_195_COMMERCIAL');

assert(title(p356.text)?.includes('사과 효능·영양성분·부작용 총정리'),'E_356_TITLE');
assert(canonical(p356.text)==='https://nhunnhun.tistory.com/356','E_356_CANONICAL');
assert(meta(p356.text,'robots')?.includes('index'),'E_356_ROBOTS');
assert(meta(p356.text,'og:image',true) && !meta(p356.text,'og:image',true).includes('opengraph.png'),'E_356_OG_IMAGE');

assert(!p352.text.includes('{{표시 텍스트}}'),'E_352_TEMPLATE_ARTIFACT');

assert(/User-agent:/i.test(robots.text),'E_ROBOTS_BODY');
assert(/Sitemap:/i.test(robots.text)||robots.text.includes('/sitemap.xml'),'E_ROBOTS_SITEMAP');
for(const id of ['/195','/352','/356']) assert(sitemap.text.includes(id),'E_SITEMAP_'+id);

assert(!home.text.includes('format_list_bulleted'),'E_HOME_ICON_TEXT');
assert(!home.text.includes('textsms'),'E_HOME_ICON_TEXTSMS');
assert(!home.text.includes('Designed by'),'E_HOME_OLD_FOOTER');
assert(!home.text.includes('쭈미로운 생활'),'E_HOME_OLD_BRAND');

console.log(JSON.stringify({
 status:'PASS',
 http:{home:home.status,p195:p195.status,p352:p352.status,p356:p356.status,robots:robots.status,sitemap:sitemap.status},
 p195:{title:title(p195.text),canonical:canonical(p195.text),internal356:true},
 p352:{templateArtifact:false},
 p356:{title:title(p356.text),canonical:canonical(p356.text),robots:meta(p356.text,'robots'),ogImage:meta(p356.text,'og:image',true)},
 home:{crawlerLigatures:false,legacyFooter:false},
 sitemap:{includes:['/195','/352','/356']}
},null,2));
