import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const cdpUrl = process.env.TISTORY_CDP_URL || 'http://127.0.0.1:9223';
const runnerDir = process.env.TISTORY_RUNNER_DIR || 'C:\\actions-runner';
const stopMarker = runnerDir + '\\maintenance.stop';

await writeFile(stopMarker, 'publish-maintenance\n', 'utf8');

async function endpointAlive() {
  try {
    const response = await fetch(cdpUrl + '/json/version', {signal:AbortSignal.timeout(1500)});
    return response.ok;
  } catch {
    return false;
  }
}

if (!await endpointAlive()) {
  console.log('PERSISTENT_CHROME_ALREADY_STOPPED');
  process.exit(0);
}

try {
  const browser = await chromium.connectOverCDP(cdpUrl, {timeout:5000,isLocal:true,noDefaults:true});
  await Promise.race([
    browser.close(),
    new Promise(resolve => setTimeout(resolve, 2500))
  ]);
} catch {}

for (let i = 0; i < 8; i++) {
  if (!await endpointAlive()) {
    console.log('PERSISTENT_CHROME_STOPPED');
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}

try {
  const netstat = execFileSync('netstat', ['-ano','-p','tcp'], {encoding:'utf8', windowsHide:true});
  const port = new URL(cdpUrl).port;
  const pids = [...new Set(netstat.split(/\r?\n/)
    .filter(line => line.includes('LISTENING') && line.includes(':'+port))
    .map(line => line.trim().split(/\s+/).at(-1))
    .filter(pid => /^\d+$/.test(pid)))];
  for (const pid of pids) {
    execFileSync('taskkill', ['/PID', pid, '/T', '/F'], {stdio:'ignore', windowsHide:true});
  }
} catch {}

for (let i = 0; i < 20; i++) {
  if (!await endpointAlive()) {
    console.log('PERSISTENT_CHROME_STOPPED');
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}

console.error('E_TISTORY_PERSISTENT_CHROME_STOP_TIMEOUT');
process.exit(31);
