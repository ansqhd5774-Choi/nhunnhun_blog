import { pathToFileURL } from 'node:url';
import { BLOG } from './core.mjs';
import { localBrowserConfig, openEditorConnection, closeEditorConnection } from './local-browser.mjs';

export async function assertTistoryAuthenticated(page) {
  let current;
  try { current = new URL(page.url()); }
  catch { throw new Error('E_TISTORY_AUTH_REQUIRED_PRECHECK'); }
  if (current.origin !== BLOG || !/^\/manage\/posts\/?$/.test(current.pathname)) {
    throw new Error('E_TISTORY_AUTH_REQUIRED_PRECHECK');
  }
  try {
    await page.getByRole('link', {name:'글쓰기', exact:true}).first()
      .waitFor({state:'visible', timeout:8000});
  } catch {
    throw new Error('E_TISTORY_AUTH_REQUIRED_PRECHECK');
  }
}

export async function runTistoryAuthPreflight() {
  let connection;
  let page;
  try {
    const config = await localBrowserConfig();
    connection = await openEditorConnection(config);
    page = await connection.context.newPage();
    await page.goto(`${BLOG}/manage/posts`, {waitUntil:'domcontentloaded', timeout:30000});
    await assertTistoryAuthenticated(page);
    await page.reload({waitUntil:'domcontentloaded', timeout:30000});
    await assertTistoryAuthenticated(page);
    console.log('TISTORY_AUTH_READY');
  } catch (error) {
    const code = error?.message === 'E_TISTORY_AUTH_REQUIRED_PRECHECK'
      ? error.message
      : 'E_TISTORY_AUTH_PRECHECK_RUNTIME';
    console.error(`TISTORY_AUTH_PREFLIGHT ${code}`);
    process.exitCode = 1;
  } finally {
    try { await page?.close({runBeforeUnload:false}); } catch {}
    try { if (connection) await closeEditorConnection(connection); } catch {}
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const watchdog = setTimeout(() => {
    console.error('TISTORY_AUTH_PREFLIGHT E_TISTORY_AUTH_PRECHECK_TIMEOUT');
    process.exit(1);
  }, 120000);
  try {
    await runTistoryAuthPreflight();
  } finally {
    clearTimeout(watchdog);
  }
  // A completed read-only auth check must not keep the CDP client or Node event loop alive.
  setTimeout(() => process.exit(process.exitCode ?? 0), 0);
}
