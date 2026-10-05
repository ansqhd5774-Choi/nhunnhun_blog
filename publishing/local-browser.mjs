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
export async function openEditorConnection(config, { engine = chromium } = {}) {
  try {
    const browser = await engine.connectOverCDP(config.cdpUrl, { timeout:15000, isLocal:true, noDefaults:true });
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
  try { await connection?.browser?.close(); }
  catch { throw new Error('E_LOCAL_BROWSER_DISCONNECT'); }
}
export async function freshEditorPage(context) {
  const pages = context.pages();
  let keeper = pages.find(page => {
    const url = page.url();
    return url.startsWith('https://nhunnhun.tistory.com/') || url.startsWith('https://www.tistory.com/');
  }) || pages[0];

  if (!keeper) keeper = await context.newPage();

  for (const page of pages) {
    if (page === keeper) continue;
    try { await page.close({runBeforeUnload:false}); } catch {}
  }
  return keeper;
}
export async function openPublicBrowser(config, engine = chromium) {
  try { return await engine.launch({headless:true, executablePath:config.chromePath}); }
  catch { throw new Error('E_LOCAL_PUBLIC_BROWSER_LAUNCH'); }
}
