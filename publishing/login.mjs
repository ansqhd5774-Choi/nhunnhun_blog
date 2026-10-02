import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
let client, session, browser;
try {
  client = new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY});
  session = await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,timeout:300,
    browserSettings:{context:{id:process.env.BROWSERBASE_CONTEXT_ID,persist:true},recordSession:false,logSession:false,solveCaptchas:false}});
  console.log(`LOGIN_SESSION_ID: ${session.id}`);
  browser = await chromium.connectOverCDP(session.connectUrl);
  const page = await browser.contexts()[0].newPage();
  await page.setViewportSize({width:480,height:720});
  await page.goto('https://nhunnhun.tistory.com/manage/posts',{waitUntil:'domcontentloaded'});
  console.log('WAITING_FOR_USER_LOGIN: use Browserbase dashboard live view; no publication');
  const deadline = Date.now()+240000;
  let authenticated = false;
  while (Date.now()<deadline) {
    const url = new URL(page.url());
    if (url.origin==='https://nhunnhun.tistory.com' && url.pathname==='/manage/posts'
      && await page.getByRole('link',{name:'글쓰기',exact:true}).count()>0) { authenticated=true; break; }
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  console.log(authenticated?'LOGIN_SAVED':'LOGIN_NOT_COMPLETED');
  if (!authenticated) process.exitCode=2;
} catch { console.error('LOGIN_SETUP_STOP: private details omitted'); process.exitCode=1; }
finally {
  try {await browser?.close();} catch {}
  if(session && client) try {
    await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'});
    console.log('SESSION_RELEASE_REQUESTED');
  } catch {console.error('SESSION_RELEASE_UNVERIFIED');process.exitCode=1;}
}
