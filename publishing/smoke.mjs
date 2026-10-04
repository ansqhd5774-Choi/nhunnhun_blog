import { BLOG } from './core.mjs';
import { localBrowserConfig, assertLocalGit, openEditorContext } from './local-browser.mjs';
let context;
try {
  assertLocalGit();
  context = await openEditorContext(await localBrowserConfig());
  const page = await context.newPage();
  await page.goto(`${BLOG}/manage/posts`, {waitUntil:'domcontentloaded', timeout:45000});
  try {
    await page.getByRole('link', {name:'글쓰기', exact:true}).first().waitFor({state:'visible', timeout:15000});
  } catch { throw new Error('E_LOGIN_REQUIRED'); }
  const url = new URL(page.url());
  if (url.origin !== BLOG || url.pathname !== '/manage/posts'
    || await page.getByRole('link', {name:'글쓰기', exact:true}).count() < 1) throw new Error('E_LOGIN_REQUIRED');
  console.log('LOCAL_BROWSER_PASS / TISTORY_LOGIN_PASS / PUBLICATION_NOT_ATTEMPTED');
} catch (error) {
  console.error(/^E_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'E_LOCAL_SMOKE');
  process.exitCode = 1;
} finally {
  try { await context?.close(); }
  catch { console.error('E_LOCAL_BROWSER_CLOSE'); process.exitCode = 1; }
}
