import { BLOG } from './core.mjs';
import { localBrowserConfig, openEditorContext } from './local-browser.mjs';
let context;
try {
  context = await openEditorContext(await localBrowserConfig(), {headless:false});
  const page = await context.newPage();
  await page.goto(`${BLOG}/manage/posts`, {waitUntil:'domcontentloaded'});
  console.log('WAITING_FOR_USER_LOGIN: 열린 전용 Chrome에서 직접 로그인하세요. 글은 발행하지 않습니다.');
  const deadline = Date.now() + 240000;
  let authenticated = false;
  while (Date.now() < deadline) {
    if (page.isClosed()) break;
    const url = new URL(page.url());
    if (url.origin === BLOG && url.pathname === '/manage/posts'
      && await page.getByRole('link', {name:'글쓰기', exact:true}).count() > 0) {
      authenticated = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!authenticated) throw new Error('E_LOGIN_REQUIRED');
  await context.close();
  context = null;
  console.log('LOGIN_SAVED');
} catch (error) {
  console.error(/^E_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'E_LOGIN_SETUP');
  process.exitCode = 1;
} finally {
  try { await context?.close(); }
  catch { console.error('E_LOCAL_BROWSER_CLOSE'); process.exitCode = 1; }
}
