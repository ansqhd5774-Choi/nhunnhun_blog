import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const MARKER = '<!-- SHARED PERFORMANCE R1 20261004 -->';
export const SYSTEM_FONT_CSS = 'html,body,button,input,select,textarea{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif!important;}.material-icons-outlined{font-family:"Material Icons Outlined";font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;width:1em;max-width:1em;overflow:hidden;-webkit-font-smoothing:antialiased;}';
export const DESKTOP_CRITICAL_STYLES = "<style id=\"zg-critical-desktop-stability-r5\">\n@media only screen and (min-width:1023px){\n  html{\n    overflow-y:scroll;\n    scrollbar-gutter:stable;\n  }\n  #wrap,\n  #wrap #container{\n    min-height:100vh;\n  }\n}\n</style>\n<style id=\"zg-critical-desktop-grid-r4\">\n@media only screen and (min-width:1023px){\n  #main.sidebarPosition.left{\n    display:grid !important;\n    grid-template-columns:302px minmax(0,1fr);\n    column-gap:45px;\n    margin:20px;\n    padding-left:0;\n  }\n  #main.sidebarPosition.left > #content{\n    grid-column:2;\n    grid-row:1;\n    min-width:0;\n  }\n  #main.sidebarPosition.left > #sidebar{\n    grid-column:1;\n    grid-row:1;\n    min-width:302px;\n    max-width:302px;\n    margin:0 !important;\n  }\n\n  #main.sidebarPosition.right{\n    display:grid !important;\n    grid-template-columns:minmax(0,1fr) 302px;\n    column-gap:45px;\n    margin:20px;\n    padding-left:10px;\n  }\n  #main.sidebarPosition.right > #content{\n    grid-column:1;\n    grid-row:1;\n    min-width:0;\n  }\n  #main.sidebarPosition.right > #sidebar{\n    grid-column:2;\n    grid-row:1;\n    min-width:302px;\n    max-width:302px;\n    margin:0 !important;\n  }\n}\n</style>\n<style id=\"zg-critical-layout-r3\">\n@media only screen and (min-width:1023px){\n  #wrap #container{width:1200px;margin:0 auto;}\n  #main.sidebarPosition.left{\n    display:flex;\n    flex-direction:row-reverse;\n    margin:20px;\n    padding-left:0;\n  }\n  #main.sidebarPosition.right{\n    display:flex;\n    margin:20px;\n    padding-left:10px;\n  }\n  #container #main #content{\n    flex:2.85;\n    overflow:hidden;\n    position:relative;\n  }\n  #container #main #sidebar{\n    flex:1;\n    max-width:302px;\n    min-width:302px;\n    height:fit-content;\n  }\n  #container #main #sidebar.left{margin-left:0;margin-right:45px;}\n  #container #main #sidebar.right{margin-left:45px;margin-right:0;}\n  .h-entry .content-width{max-width:810px;margin:0 auto;}\n}\n</style>";
export function stabilizeDesktop(source, criticalStyles = DESKTOP_CRITICAL_STYLES) {
  // Same skin layout; preserve each existing R3/R4/R5 block rather than overriding it.
  return source.includes('id="zg-critical-desktop-grid-r4"') ? source : source.replace('</head>', criticalStyles + '\n</head>');
}
export const IMAGE_SCRIPT = `<script id="shared-performance-images-20261004">
(function(){
  if(location.pathname!=='/6')return;
  var seen=new WeakSet();
  // Live original-image dimensions verified on 2026-10-04; unknown images are untouched.
  var dimensions={bW7T4l:[640,480],bkYrKJ:[960,638],c9UbsI:[960,708],dAiJab:[637,615],kOURe:[2710,1802],p1OWZ:[800,432]};
  function optimize(img){
    if(seen.has(img)||!img.closest('.contents_style')||!img.getAttribute('style')?.includes('max-width:720px'))return;
    var original=img.getAttribute('src');
    if(!original||!original.startsWith('https://blog.kakaocdn.net/'))return;
    var key=original.split('/')[4],size=dimensions[key];
    if(!size)return;
    seen.add(img);
    if(!img.hasAttribute('width'))img.setAttribute('width',size[0]);
    if(!img.hasAttribute('height'))img.setAttribute('height',size[1]);
    img.addEventListener('error',function(){img.removeAttribute('srcset');img.removeAttribute('sizes');},{once:true});
    // src and OG identity remain the native original, preserving publisher verification.
    img.setAttribute('sizes','(max-width:760px) calc(100vw - 40px), 720px');
    img.setAttribute('srcset','https://img1.daumcdn.net/thumb/R960x0.fwebp.q85/?fname='+encodeURIComponent(original)+' '+Math.min(size[0],960)+'w');
  }
  function scan(node){
    if(node.nodeType!==1)return;
    if(node.tagName==='IMG')optimize(node);
    node.querySelectorAll('img').forEach(optimize);
  }
  var observer=new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(scan);});});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.contents_style img').forEach(optimize);observer.disconnect();},{once:true});
})();
</script>`;
export function optimizeImages(source) {
  return source.includes('id="shared-performance-images-20261004"') ? source.replace(/<script id="shared-performance-images-20261004">[\s\S]*?<\/script>/, IMAGE_SCRIPT) : source.replace('<head>', IMAGE_SCRIPT + '\n<head>');
}
export function optimizeHtml(source) {
  // Live script order: native jQuery -> bridge -> both common.js scripts.
  // Preserve asynchronous common.js; blocking it regressed first paint in the probe.
  source = source.replace('window.jQuery = tjQuery;', 'window.jQuery = window.$ = tjQuery;').replace('ASYNC_SCRIPTS=["tiara.min.js","kakao.min.js"]', 'ASYNC_SCRIPTS=["tiara.min.js","common.js","kakao.min.js"]');
  // Reuse the main blog's existing font strategy; keep Material Icons and its fallback.
  source = source.replace(/<link\b[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?family=\[##_var_mainFont_##\][^"]*"[^>]*>\s*/g,'').replace(/<noscript>\s*<\/noscript>/g,'');
  source=source.replace(/<style id="shared-performance-system-font">[\s\S]*?<\/style>/, '<style id="shared-performance-system-font">'+SYSTEM_FONT_CSS+'</style>');
  if (!source.includes('id="shared-performance-system-font"')) source = source.replace('</head>','<style id="shared-performance-system-font">'+SYSTEM_FONT_CSS+'</style>\n</head>');
  if (source.includes(MARKER)) return source;
  if (!source.includes('<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />')) throw new Error('UNSUPPORTED_SKIN');
  const origins = ['https://t1.daumcdn.net', 'https://tistory1.daumcdn.net', 'https://edge.daumcdn.net', 'https://t1.kakaocdn.net', 'https://blog.kakaocdn.net'];
  const early = MARKER + '\n' + origins.map(origin => `<link rel="preconnect" href="${origin}" crossorigin>`).join('\n') + '\n<link rel="dns-prefetch" href="https://fonts.googleapis.com">\n<link rel="dns-prefetch" href="https://fonts.gstatic.com">\n<link rel="preload" as="style" href="./style.css">\n';
  let result = source.replace(/<link\b[^>]*rel="preconnect"[^>]*>\s*/g, '').replace(/<link\b[^>]*rel="preload"[^>]*href="\.\/style\.css"[^>]*>\s*/g, '').replace('<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />', '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\n' + early);
  // Already asynchronous font links and their noscript fallbacks remain intact.
  result = result.replace(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/[^\"]+)"\s*>/g, (_, href, offset) => {
    if (result.slice(Math.max(0, offset - 10), offset).endsWith('<noscript>')) return _;
    return `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
  });
  return result;
}
export function enableImmediateContent(css) {
  const marker = '/* SHARED PERFORMANCE R1: render content without waiting for script fade-in */';
  return css.includes(marker) ? css : css + '\n' + marker + '\n#content,#content.show{opacity:1!important;transition:none!important;}\n';
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('USAGE: node scripts/optimize-skin-performance.mjs ORIGINAL.html NEW.html');
  const source = await readFile(input, 'utf8');
  await writeFile(output, stabilizeDesktop(optimizeImages(optimizeHtml(source))));
  console.log('SKIN_PATCH_READY: original preserved; apply and verify via official Tistory editor');
}
