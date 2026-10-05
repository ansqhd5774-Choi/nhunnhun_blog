import { access, mkdir, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

export function assertDedicatedProfile(profileDir) {
  if (!profileDir || !isAbsolute(profileDir)) throw new Error('E_LOCAL_PROFILE_REQUIRED');
  if (/[\\/]Google[\\/]Chrome[\\/]User Data(?:[\\/]|$)/i.test(profileDir)) throw new Error('E_LOCAL_PROFILE_REQUIRED');
}
export function assertLocalCdpUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('E_LOCAL_CDP_REQUIRED'); }
  if (url.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('E_LOCAL_CDP_REQUIRED');
  if (!url.port) throw new Error('E_LOCAL_CDP_REQUIRED');
  return url.toString().replace(/\/$/,'');
}
export async function localBrowserConfig(env = process.env) {
  const chromePath = env.TISTORY_CHROME_PATH;
  const profileDir = env.TISTORY_PROFILE_DIR;
  const cdpUrl = assertLocalCdpUrl(env.TISTORY_CDP_URL || 'http://127.0.0.1:9223');
  if (!chromePath || !isAbsolute(chromePath)) throw new Error('E_LOCAL_CHROME_REQUIRED');
  try {
    await access(chromePath, constants.R_OK);
    if (!(await stat(chromePath)).isFile()) throw new Error();
  } catch { throw new Error('E_LOCAL_CHROME_REQUIRED'); }
  assertDedicatedProfile(profileDir);
  try {
    await mkdir(profileDir, { recursive:true });
    assertDedicatedProfile(await realpath(profileDir));
    await access(profileDir, constants.R_OK | constants.W_OK);
    if (!(await stat(profileDir)).isDirectory()) throw new Error();
  } catch (error) {
    if (error.message === 'E_LOCAL_PROFILE_REQUIRED') throw error;
    throw new Error('E_LOCAL_PROFILE_ACCESS');
  }
  return { chromePath:resolve(chromePath), profileDir:resolve(profileDir), cdpUrl };
}
export function assertLocalGit(run = execFileSync) {
  try { run('git', ['--version'], { encoding:'utf8', stdio:'pipe', windowsHide:true }); }
  catch { throw new Error('E_LOCAL_GIT_REQUIRED'); }
}
async function resolveCdpWebSocket(cdpUrl, fetchFn = fetch) {
  const response = await fetchFn(cdpUrl + '/json/version', { signal:AbortSignal.timeout(3000) });
  if (!response?.ok) throw new Error('E_LOCAL_CDP_VERSION');
  const payload = await response.json();
  const raw = payload?.webSocketDebuggerUrl;
  let ws;
  try { ws = new URL(raw); } catch { throw new Error('E_LOCAL_CDP_WEBSOCKET'); }
  const http = new URL(cdpUrl);
  if (ws.protocol !== 'ws:' || !['127.0.0.1','localhost'].includes(ws.hostname) || ws.port !== http.port) {
    throw new Error('E_LOCAL_CDP_WEBSOCKET');
  }
  return ws.toString();
}
export async function openEditorConnection(config, { engine = chromium, fetchFn = fetch } = {}) {
  let browser;
  try {
    browser = await engine.connectOverCDP(config.cdpUrl, { timeout:15000, isLocal:true, noDefaults:true });
  } catch (httpError) {
    const httpMessage=String(httpError?.message||httpError||'').replace(/[\r\n]+/g,' ').slice(0,500);
    console.error('LOCAL_BROWSER_HTTP_DIAG '+JSON.stringify({name:httpError?.name||'Error',message:httpMessage}));
    try {
      const wsEndpoint = await resolveCdpWebSocket(config.cdpUrl, fetchFn);
      browser = await engine.connectOverCDP(wsEndpoint, { timeout:15000, isLocal:true, noDefaults:true });
      console.log('LOCAL_BROWSER_CONNECT_FALLBACK=websocket');
    } catch (wsError) {
      const wsMessage=String(wsError?.message||wsError||'').replace(/[\r\n]+/g,' ').slice(0,500);
      console.error('LOCAL_BROWSER_WS_DIAG '+JSON.stringify({name:wsError?.name||'Error',message:wsMessage}));
      throw new Error('E_LOCAL_BROWSER_CONNECT');
    }
  }
  try {
    const contexts = browser.contexts();
    if (contexts.length !== 1) {
      browser._shouldCloseConnectionOnClose = true;
      await browser.close();
      throw new Error('E_LOCAL_BROWSER_CONTEXT');
    }
    browser._shouldCloseConnectionOnClose = true;
    return { browser, context:contexts[0] };
  } catch (error) {
    if (error?.message === 'E_LOCAL_BROWSER_CONTEXT') throw error;
    throw new Error('E_LOCAL_BROWSER_CONNECT');
  }
}
export async function closeEditorConnection(connection) {
  const browser = connection?.browser;
  if (!browser) return;
  try {
    if (browser._connection?.close) {
      browser._connection.close();
      return;
    }
    browser._shouldCloseConnectionOnClose = true;
    await Promise.race([
      browser.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('disconnect-timeout')), 3000))
    ]);
  } catch { throw new Error('E_LOCAL_BROWSER_DISCONNECT'); }
}
export async function freshEditorPage(context) {
  const pages = context.pages();
  const anchor = pages.find(page => {
    try {
      const url = new URL(page.url());
      return url.origin === 'https://nhunnhun.tistory.com'
        && url.pathname.startsWith('/manage')
        && !/^\/manage\/post(?:[/?#]|$)/.test(url.pathname);
    } catch {
      return false;
    }
  }) || null;

  for (const page of pages) {
    if (page === anchor) continue;
    const url = page.url();
    if (!/^https:\/\/nhunnhun\.tistory\.com\/manage\/post(?:[/?#]|$)/.test(url)) continue;
    try { await page.close({runBeforeUnload:false}); } catch {}
  }

  return anchor || context.newPage();
}
export async function ensureEditorRendering(context, page) {
  // noDefaults preserves the user's Chrome settings but skips Playwright's
  // focus emulation. Hidden tabs can suspend the animation-frame polling
  // used by locator actions. Restore only this override for the editor tab.
  try {
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setFocusEmulationEnabled', { enabled:true });
    return session;
  } catch { throw new Error('E_EDITOR_RENDERING'); }
}
export async function openPublicBrowser(config, engine = chromium) {
  try { return await engine.launch({headless:true, executablePath:config.chromePath}); }
  catch { throw new Error('E_LOCAL_PUBLIC_BROWSER_LAUNCH'); }
}
