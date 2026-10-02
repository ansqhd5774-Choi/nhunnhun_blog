import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { BLOG, loadPosts, eligible, fingerprint, assertArticleUrl, plainText, textHtml } from './core.mjs';
import { Ledger } from './ledger.mjs';


function imageSources(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi)].map(m => m[2]);
}
async function downloadImage(url, path) {
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent':'Mozilla/5.0',
        'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal:AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const type = response.headers.get('content-type') ?? '';
      if (!type.toLowerCase().startsWith('image/')) throw new Error('E_IMAGE_CONTENT_TYPE');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error('E_IMAGE_SIZE');
      await writeFile(path, bytes);
      return;
    }
    last = String(response.status);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('E_IMAGE_DOWNLOAD_' + last);
}
async function uploadImage(page, sourceUrl, index) {
  const path = `/tmp/tistory-image-${index}.bin`;
  await downloadImage(sourceUrl, path);
  await page.evaluate(() => document.querySelectorAll('#attach-layer-btn')[0]?.click());
  const responsePromise = page.waitForResponse(res =>
    res.url().includes('/manage/post/attach.json') &&
    res.request().method() === 'POST' &&
    res.status() === 200
  , {timeout:30000});
  await page.locator('#attach-image').setInputFiles(path);
  const data = await (await responsePromise).json();
  if (!data?.url || !data.url.includes('kakaocdn.net')) throw new Error('E_IMAGE_UPLOAD');
  return data.url;
}
function replaceImageSources(html, mapping, representativeSource) {
  let first = true;
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const match = tag.match(/\bsrc=(["'])(.*?)\1/i);
    if (!match) return tag;
    const source = match[2];
    const target = mapping.get(source);
    if (!target) throw new Error('E_IMAGE_MAPPING');
    let out = tag.replace(match[0], `src="${target}"`);
    out = out.replace(/\s(?:loading|decoding|fetchpriority)=(["']).*?\1/gi, '');
    const isPriority = source === representativeSource || first;
    out = out.replace(/>$/, ` loading="${isPriority ? 'eager' : 'lazy'}" decoding="async"${isPriority ? ' fetchpriority="high"' : ''}>`);
    first = false;
    return out;
  });
}

let browser, client, session, editorPage;
let stage = 'configuration';
try {
  if (process.env.PUBLISH_ENABLED !== 'true') {
    console.log('DISABLED: 클라우드 연결과 운영 검증 전에는 발행하지 않습니다.');
  } else {
    for (const name of ['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID','BROWSERBASE_CONTEXT_ID']) {
      if (!process.env[name]) throw new Error('E_CLOUD_CONFIGURATION');
    }
    const ledger = new Ledger();
    const queue = [];
    for (const post of await loadPosts()) if (eligible(post, await ledger.read(post.id))) queue.push(post);
    if (queue.length > 1) throw new Error('E_ONE_POST_PER_RUN');
    if (queue.length) {
      const post = queue[0];
      stage = 'cloud-connect';
      client = new Browserbase({ apiKey:process.env.BROWSERBASE_API_KEY });
      session = await client.sessions.create({
        projectId:process.env.BROWSERBASE_PROJECT_ID,
        browserSettings: { context:{ id:process.env.BROWSERBASE_CONTEXT_ID, persist:true }, recordSession:false, logSession:false, solveCaptchas:false },
        timeout:300,
      });
      browser = await chromium.connectOverCDP(session.connectUrl);
      stage = 'editor-open';
      const context = browser.contexts()[0];
      const page = await context.newPage();
      editorPage = page;
      page.setDefaultTimeout(20000);
      // The ordinary editor is used; no retired/undocumented Tistory write endpoint or cookie export.
      page.on('dialog', async dialog => {
        if (dialog.type() === 'confirm' && /모드.*변경|변경.*모드/.test(dialog.message())) await dialog.accept();
        else await dialog.dismiss();
      });
      await page.goto(`${BLOG}/manage/post`, { waitUntil:'domcontentloaded' });
      if (new URL(page.url()).origin !== BLOG) throw new Error('E_LOGIN_REQUIRED');
      await page.locator('#post-title-inp').waitFor({state:'visible'});
      stage = 'editor-content';
      await page.locator('#post-title-inp').fill(post.title);
      stage = 'image-upload';
      const sources = [...new Set(imageSources(post.bodyHtml))];
      const representativeSource = post.representativeImageUrl || sources[0] || null;
      const uploadOrder = representativeSource ? [representativeSource, ...sources.filter(src => src !== representativeSource)] : sources;
      const imageMap = new Map();
      for (let i = 0; i < uploadOrder.length; i++) imageMap.set(uploadOrder[i], await uploadImage(page, uploadOrder[i], i));
      const bodyHtml = sources.length ? replaceImageSources(post.bodyHtml, imageMap, representativeSource) : post.bodyHtml;
      stage = 'mode-menu';
      await page.locator('#editor-mode-layer-btn-open').click();
      stage = 'html-mode';
      await page.locator('#editor-mode-html').click();
      stage = 'html-body';
      await page.locator('.CodeMirror:visible .CodeMirror-code').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(bodyHtml);
      stage = 'category-tags';
      await page.locator('#category-btn').click();
      await page.locator('#category-list').waitFor({state:'visible'});
      const matches = [];
      for (const option of await page.locator('#category-list [role="option"]').all()) {
        if ((await option.innerText()).trim().replace(/^-\s*/, '') === post.category) matches.push(option);
      }
      if (matches.length !== 1) throw new Error('E_CATEGORY_AMBIGUOUS');
      await matches[0].click();
      for (const tag of post.tags) { await page.locator('#tagText').fill(tag); await page.locator('#tagText').press('Enter'); }
      await page.locator('#publish-layer-btn').click();
      stage = 'publish-dialog';
      if (representativeSource && await page.locator('.publish_editor .box_thumb').count() !== 1) throw new Error('E_REPRESENTATIVE_UNVERIFIED');
      await page.getByLabel('공개', {exact:true}).check();
      const publishButton = page.getByRole('button', {name:'공개 발행',exact:true});
      await publishButton.waitFor({state:'visible'});
      if (await page.locator('#post-title-inp').inputValue() !== post.title) throw new Error('E_TITLE_MISMATCH');
      // Durable checkpoint BEFORE the irreversible final click. A timeout must never resubmit blindly.
      const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
      await ledger.write(post.id, {phase:'submitting', fingerprint:fingerprint(post), sourceCommit, timestamp:new Date().toISOString()});
      stage = 'final-submit';
      await publishButton.click();
      await page.waitForURL(url => url.origin === BLOG && /\/manage\/posts\/?$/.test(url.pathname));
      const articleLink = page.getByRole('link', {name:post.title,exact:true});
      if (await articleLink.count() !== 1) throw new Error('E_PUBLICATION_UNCERTAIN');
      const url = assertArticleUrl(new URL(await articleLink.getAttribute('href'), BLOG).href);
      stage = 'public-verification';
      // Verify anonymously, so an owner-only/private page cannot count as published.
      const publicContext = await browser.newContext();
      const publicPage = await publicContext.newPage();
      await publicPage.goto(url, {waitUntil:'domcontentloaded'});
      if (!(await publicPage.locator('body').innerText()).includes(post.title)) throw new Error('E_PUBLICATION_UNCERTAIN');
      const content = publicPage.locator('.contents_style');
      if (await content.count() !== 1) throw new Error('E_BODY_UNVERIFIED');
      const actual = (await content.innerText()).replace(/\s+/g,' ').trim();
      const expected = plainText(post.bodyHtml);
      // Parse text entities through the browser to avoid HTML entity mismatches.
      const expectedText = await publicPage.evaluate(html => { const doc = new DOMParser().parseFromString(html,'text/html'); return doc.body.textContent.replace(/\s+/g,' ').trim(); }, textHtml(post.bodyHtml));
      if (!expected || !actual.includes(expectedText)) throw new Error('E_BODY_UNVERIFIED');
      if (sources.length) {
        const publicImages = await content.locator('img').evaluateAll(imgs => imgs.map(img => img.src));
        if (publicImages.length < sources.length || publicImages.slice(0, sources.length).some(src => !src.includes('kakaocdn.net'))) throw new Error('E_IMAGE_UNVERIFIED');
      }
      if (representativeSource) {
        const og = await publicPage.locator('meta[property="og:image"]').getAttribute('content').catch(()=>null);
        if (!og || og.includes('opengraph.png')) throw new Error('E_REPRESENTATIVE_UNVERIFIED');
      }
      const state = await ledger.read(post.id);
      if (state?.phase !== 'submitting' || state.fingerprint !== fingerprint(post)) throw new Error('E_LEDGER_CONFLICT');
      await ledger.write(post.id, {phase:'published',fingerprint:fingerprint(post),url,timestamp:new Date().toISOString()}, state.sha);
      console.log(`PUBLISHED: ${post.id} ${url}`);
    } else console.log('NO_PENDING_POSTS');
  }
} catch (error) {
  const code = /^E_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'E_RUNTIME';
  console.error(`DIAGNOSTIC: ${stage} ${code}`);
  if (editorPage && stage !== 'final-submit' && stage !== 'public-verification') try {
    console.log('EDITOR_CONTROLS: '+JSON.stringify(await editorPage.evaluate(()=>({
      codeMirror:document.querySelectorAll('.CodeMirror').length,
      codeMirrorCode:document.querySelectorAll('.CodeMirror-code').length,
      inputs:Array.from(document.querySelectorAll('textarea')).map(e=>({id:e.id,class:e.className})),
      modeText:document.querySelector('#editor-mode-layer-btn-open')?.textContent,
    }))));
  } catch {}
  // Provider exceptions can carry credentials/connect URLs: never log raw exceptions.
  console.error('STOP: 클라우드 설정·로그인·에디터·발행 증거를 확인해야 합니다. 실패 직후 임의 재발행하지 마세요.');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch {}
  if (session && client) {
    try { await client.sessions.update(session.id, {projectId:process.env.BROWSERBASE_PROJECT_ID, status:'REQUEST_RELEASE'}); }
    catch { console.error('STOP: 클라우드 세션 종료 상태 확인 필요.'); process.exitCode = 1; }
  }
}
