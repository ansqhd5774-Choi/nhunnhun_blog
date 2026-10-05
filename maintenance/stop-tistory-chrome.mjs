import { chromium } from 'playwright-core';

const cdpUrl = process.env.TISTORY_CDP_URL || 'http://127.0.0.1:9223';

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

let browser;
try {
  browser = await chromium.connectOverCDP(cdpUrl, {timeout:5000,isLocal:true,noDefaults:true});
  await browser.close();
} catch {
  console.error('E_TISTORY_PERSISTENT_CHROME_STOP');
  process.exit(31);
}

for (let i = 0; i < 30; i++) {
  if (!await endpointAlive()) {
    console.log('PERSISTENT_CHROME_STOPPED');
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}

console.error('E_TISTORY_PERSISTENT_CHROME_STOP_TIMEOUT');
process.exit(31);
