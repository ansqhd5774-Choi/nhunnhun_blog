import { readFile, readdir } from 'node:fs/promises';
import sanitizeHtml from 'sanitize-html';
import { loadPosts } from './core.mjs';

function diagnoseHtml(html) {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p','br','h2','h3','h4','strong','em','u','s','ul','ol','li','blockquote','table','thead','tbody','tr','th','td','a','img','hr','span'],
    allowedAttributes: { a:['href','title'], img:['src','alt','width','height'], th:['colspan','rowspan'], td:['colspan','rowspan'] },
    allowedSchemes: ['https'], allowProtocolRelative: false,
  });
  if (clean === html) return null;
  let i=0;
  while (i < clean.length && i < html.length && clean[i] === html[i]) i++;
  return {
    index:i,
    before:html.slice(Math.max(0,i-80),i+160),
    after:clean.slice(Math.max(0,i-80),i+160),
  };
}

try {
  const posts = await loadPosts();
  console.log(`PASS: ${posts.length} posts validated; ${posts.filter(p => p.status === 'ready').length} ready.`);
} catch (error) {
  const code = /^E_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'E_VALIDATE_RUNTIME';
  if (code === 'E_HTML_REQUIRES_REVIEW') {
    for (const name of (await readdir('posts')).filter(n => n.endsWith('.json')).sort()) {
      const post = JSON.parse(await readFile('posts/'+name,'utf8'));
      const diff = typeof post.bodyHtml === 'string' ? diagnoseHtml(post.bodyHtml) : null;
      if (diff) {
        console.error('HTML_DIFF '+name+' '+JSON.stringify(diff));
        break;
      }
    }
  }
  console.error(`FAIL: ${code} — 글 형식·승인·HTML 검사를 통과하지 못했습니다. 게시하지 않습니다.`);
  process.exitCode = 1;
}
