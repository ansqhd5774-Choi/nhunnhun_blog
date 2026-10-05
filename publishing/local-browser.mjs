import { access, mkdir, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

export function assertDedicatedProfile(profileDir) {
  if (!profileDir || !isAbsolute(profileDir)) throw new Error('E_LOCAL_PROFILE_REQUIRED');
  if (/[\\/]Google[\\/]Chrome[\\/]User Data(?:[\\/]|$)/i.test(profileDir)) throw new Error('E_LOCAL_PROFILE_REQUIRED');
}
export async function localBrowserConfig(env = process.env) {
  const chromePath = env.TISTORY_CHROME_PATH;
  const profileDir = env.TISTORY_PROFILE_DIR;
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
  return { chromePath:resolve(chromePath), profileDir:resolve(profileDir) };
}
export function assertLocalGit(run = execFileSync) {
  try { run('git', ['--version'], { encoding:'utf8', stdio:'pipe', windowsHide:true }); }
  catch { throw new Error('E_LOCAL_GIT_REQUIRED'); }
}
export async function openEditorContext(config, { headless = false, engine = chromium } = {}) {
  try {
    return await engine.launchPersistentContext(config.profileDir, {
      headless,
      executablePath:config.chromePath,
      args:['--no-first-run','--no-default-browser-check','--disable-session-crashed-bubble']
    });
  } catch { throw new Error('E_LOCAL_BROWSER_LAUNCH'); }
}
export async function freshEditorPage(context) {
  for (const page of context.pages()) {
    try { await page.close({runBeforeUnload:false}); } catch {}
  }
  return await context.newPage();
}
export async function openPublicBrowser(config, engine = chromium) {
  try { return await engine.launch({headless:true, executablePath:config.chromePath}); }
  catch { throw new Error('E_LOCAL_PUBLIC_BROWSER_LAUNCH'); }
}
