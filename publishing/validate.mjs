import { loadPosts } from './core.mjs';
try {
  const posts = await loadPosts();
  console.log(`PASS: ${posts.length} posts validated; ${posts.filter(p => p.status === 'ready').length} ready.`);
} catch (error) {
  const code = /^E_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'E_VALIDATE_RUNTIME';
  console.error(`FAIL: ${code} — 글 형식·승인·HTML 검사를 통과하지 못했습니다. 게시하지 않습니다.`);
  process.exitCode = 1;
}
