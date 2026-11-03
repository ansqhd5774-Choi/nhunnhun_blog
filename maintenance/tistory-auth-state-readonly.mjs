import { BLOG } from '../publishing/core.mjs';
import { localBrowserConfig, openEditorConnection, closeEditorConnection } from '../publishing/local-browser.mjs';

// Read-only, credential-free classification. No page URLs, cookies, tokens or
// element text are printed; the writer-session remains the sole submitter.
let connection;
let page;
try {
  connection=await openEditorConnection(await localBrowserConfig());
  page=await connection.context.newPage();
  await page.goto(BLOG+'/manage/posts',{waitUntil:'domcontentloaded',timeout:30000});
  let manageRoute=false;
  try {
    const current=new URL(page.url());
    manageRoute=current.origin===BLOG && /^\/manage\/posts\/?$/.test(current.pathname);
  } catch {}
  const write=page.getByRole('link',{name:'글쓰기',exact:true}).first();
  let writeLinkPresent=false;
  let writeLinkVisible=false;
  if(manageRoute) {
    writeLinkPresent=await write.count()>0;
    if(writeLinkPresent) writeLinkVisible=await write.isVisible();
  }
  console.log('TISTORY_AUTH_STATE '+JSON.stringify({
    manageRoute,writeLinkPresent,writeLinkVisible,
    ready:manageRoute&&writeLinkVisible,publicationAttempted:false
  }));
} catch {
  console.log('TISTORY_AUTH_STATE '+JSON.stringify({status:'READONLY_RUNTIME_FAILURE',publicationAttempted:false}));
  process.exitCode=1;
} finally {
  try { await page?.close({runBeforeUnload:false}); } catch {}
  try { await closeEditorConnection(connection); } catch {process.exitCode=1;}
}
