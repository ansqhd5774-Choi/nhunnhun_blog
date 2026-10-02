import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
let client, session, browser;
try {
  for (const name of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
    if (!process.env[name]) throw new Error('CONFIG_MISSING');
  }
  client = new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
  session = await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,timeout:300,
    browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false}});
  console.log('CLOUD_CONNECTION_PASS');
  browser = await chromium.connectOverCDP(session.connectUrl);
  const page = await browser.contexts()[0].newPage();
  await page.goto('https://nhunnhun.tistory.com/manage/posts',{waitUntil:'domcontentloaded',timeout:45000});
  const url = new URL(page.url());
  const loggedIn = url.origin === 'https://nhunnhun.tistory.com' && url.pathname === '/manage/posts'
    && await page.getByRole('link',{name:'글쓰기',exact:true}).count() > 0;
  console.log(loggedIn ? 'TISTORY_LOGIN_PASS' : 'TISTORY_LOGIN_REQUIRED');
  if (!loggedIn) process.exitCode = 2;
  console.log('PUBLICATION_NOT_ATTEMPTED');
} catch {
  console.error('CLOUD_SMOKE_STOP: connection or browser probe failed; credentials and private URLs omitted');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch {}
  if (session && client) try {
    await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});
    console.log('SESSION_RELEASE_REQUESTED');
  } catch { console.error('SESSION_RELEASE_UNVERIFIED'); process.exitCode = 1; }
}
