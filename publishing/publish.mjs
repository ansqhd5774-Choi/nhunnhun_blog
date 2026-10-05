import { verificationContext } from './verification-context.mjs';
import { safeRuntimeDiagnostic } from './runtime-diagnostics.mjs';
import { assertCurrentSource } from './runner-gate.mjs';
import { localBrowserConfig, assertLocalGit, openEditorConnection, closeEditorConnection, openPublicBrowser, freshEditorPage } from './local-browser.mjs';
import { execFileSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BLOG, loadPosts, checkPublishHtml, eligible, fingerprint, assertArticleUrl } from './core.mjs';
import { Ledger } from './ledger.mjs';
import { renderEditorialPost, editorialExpectations, assertEditorialContract, EDITORIAL_TEMPLATE_VERSION } from './editorial.mjs';
import { assertImageReview } from './image-review.mjs';


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
  const path = join(imageTempDir, `tistory-image-${index}.bin`);
  await downloadImage(sourceUrl, path);
  const input = page.locator('#attach-image');
  if (await input.count() === 0) {
    const opened = await page.evaluate(() => {
      const button = document.querySelectorAll('#attach-layer-btn')[0];
      if (!button) return false;
      button.click();
      return true;
    });
    if (!opened) throw new Error('E_IMAGE_ATTACH_BUTTON');
    await input.waitFor({state:'attached', timeout:10000});
  }
  const responsePromise = page.waitForResponse(res =>
    res.url().includes('/manage/post/attach.json') &&
    res.request().method() === 'POST'
  , {timeout:30000});
  try {
    await input.setInputFiles(path);
  } catch {
    throw new Error('E_IMAGE_INPUT');
  }
  let uploadResponse;
  try {
    uploadResponse = await responsePromise;
  } catch {
    throw new Error('E_IMAGE_RESPONSE_TIMEOUT');
  }
  if (uploadResponse.status() !== 200) throw new Error('E_IMAGE_UPLOAD_HTTP');
  let data;
  try {
    data = await uploadResponse.json();
  } catch {
    throw new Error('E_IMAGE_UPLOAD_RESPONSE');
  }
  if (!data?.url || !data.url.includes('kakaocdn.net')) throw new Error('E_IMAGE_UPLOAD');
  await page.waitForTimeout(400);
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

let editorConnection, editorContext, publicBrowser, editorPage, imageTempDir;
let finalSubmitDialogs = [];
let stage = 'configuration';
let fatalExitCode = 0;
try {
  if (process.env.PUBLISH_ENABLED !== 'true') {
    console.log('DISABLED: 발행 활성화 전에는 게시하지 않습니다.');
  } else {
    assertLocalGit();
    assertCurrentSource();
    const ledger = new Ledger();
    const queue = [];
    for (const post of await loadPosts()) {
      const state = await ledger.read(post.id);
      if (eligible(post, state)) {
        checkPublishHtml(post);
        assertImageReview(post);
        queue.push({post, previousStateSha: state?.phase === 'failed' ? state.sha : undefined});
      }
    }
    if (queue.length > 1) throw new Error('E_ONE_POST_PER_RUN');
    if (queue.length) {
      const {post, previousStateSha} = queue[0];
      stage = 'local-browser';
      const browserConfig = await localBrowserConfig();
      editorConnection = await openEditorConnection(browserConfig);
      editorContext = editorConnection.context;
      imageTempDir = await mkdtemp(join(tmpdir(), 'tistory-images-'));
      stage = 'editor-open';
      const page = await freshEditorPage(editorContext);
      editorPage = page;
      page.setDefaultTimeout(20000);
      // The ordinary editor is used; no retired/undocumented Tistory write endpoint or cookie export.
      page.on('dialog', dialog => {
        void (async () => {
          try {
            const type = dialog.type();
            const message = dialog.message();
            console.log('DIALOG_DIAG '+JSON.stringify({stage,type,message}));
            if (type === 'confirm' && (stage === 'html-mode' || stage === 'final-submit' || /모드.*변경|변경.*모드/.test(message))) {
              await dialog.accept();
              console.log('DIALOG_ACTION '+JSON.stringify({stage,type,action:'accept'}));
            }
            else if (type === 'alert') await dialog.accept();
            else await dialog.dismiss();
          } catch (error) {
            const message = String(error?.message || error || '');
            if (!/No dialog is showing|Target page, context or browser has been closed|Browser has been closed/i.test(message)) {
              console.error('E_DIALOG_HANDLER');
            }
          }
        })();
      });
      stage = 'login-check';
      await page.goto(`${BLOG}/manage/posts`, {waitUntil:'domcontentloaded'});
      const managerUrl = new URL(page.url());
      if (managerUrl.origin !== BLOG || managerUrl.pathname !== '/manage/posts') throw new Error('E_LOGIN_REQUIRED');
      try {
        await page.getByRole('link', {name:'글쓰기', exact:true}).first().waitFor({state:'visible', timeout:15000});
      } catch {
        throw new Error('E_LOGIN_REQUIRED');
      }
      stage = 'editor-open';
      await page.goto(`${BLOG}/manage/post`, { waitUntil:'domcontentloaded' });
      if (new URL(page.url()).origin !== BLOG) throw new Error('E_LOGIN_REQUIRED');
      await page.locator('#post-title-inp').waitFor({state:'visible'});
      stage = 'editor-content';
      await page.locator('#post-title-inp').fill(post.title);
      stage = 'image-upload';
      const editorialHtml = renderEditorialPost(post);
      const editorialExpected = editorialExpectations(post.bodyHtml);
      const sources = [...new Set(imageSources(editorialHtml))];
      const representativeSource = post.representativeImageUrl || sources[0] || null;
      const uploadOrder = representativeSource ? [representativeSource, ...sources.filter(src => src !== representativeSource)] : sources;
      const imageMap = new Map();
      for (let i = 0; i < uploadOrder.length; i++) imageMap.set(uploadOrder[i], await uploadImage(page, uploadOrder[i], i));
      const bodyHtml = sources.length ? replaceImageSources(editorialHtml, imageMap, representativeSource) : editorialHtml;
      stage = 'mode-menu';
      await page.locator('#editor-mode-layer-btn-open').click();
      stage = 'html-mode';
      await page.locator('#editor-mode-html').click();
      stage = 'html-body';
      await page.locator('.CodeMirror:visible .CodeMirror-code').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(bodyHtml);
      const stagedHtml = await page.locator('.CodeMirror:visible').evaluate(el=>el?.CodeMirror?.getValue?.()||'');
      if (!stagedHtml.trim()) throw new Error('E_EDITOR_HTML_BODY');
      assertEditorialContract(stagedHtml, post.bodyHtml);
      stage = 'category-tags';
      await page.locator('#category-btn').click();
      await page.locator('#category-list').waitFor({state:'visible'});
      const matches = [];
      for (const option of await page.locator('#category-list [role="option"]').all()) {
        if ((await option.innerText()).trim().replace(/^[-·]\s*/, '') === post.category) matches.push(option);
      }
      if (matches.length !== 1) {
        const labels = await page.locator('#category-list [role="option"]').allInnerTexts().catch(()=>[]);
        console.error('CATEGORY_DIAG '+JSON.stringify({target:post.category,labels}));
        throw new Error('E_CATEGORY_AMBIGUOUS');
      }
      await matches[0].click();
      const tagInput = page.locator('#tagText');
      await tagInput.waitFor({state:'visible', timeout:10000}).catch(() => { throw new Error('E_TAG_CONTROL'); });
      for (const tag of post.tags) { await tagInput.fill(tag); await tagInput.press('Enter'); }
      await page.locator('#publish-layer-btn').click();
      stage = 'publish-dialog';
      if (representativeSource) {
        const thumb = page.locator('.publish_editor .box_thumb');
        if (await thumb.count() !== 1) throw new Error('E_REPRESENTATIVE_UNVERIFIED');
        const text = (await thumb.innerText().catch(()=>'')) || '';
        if (text.includes('대표이미지 추가')) {
          const repPath = join(imageTempDir, 'tistory-representative.bin');
          await downloadImage(representativeSource, repPath);
          const input = thumb.locator('input[type="file"]');
          if (await input.count() !== 1) throw new Error('E_REPRESENTATIVE_UNVERIFIED');
          await input.setInputFiles(repPath);
          await page.waitForFunction(() => {
            const box=document.querySelector('.publish_editor .box_thumb');
            if (!box) return false;
            const text=(box.textContent||'').trim();
            return !text.includes('대표이미지 추가') || !!box.querySelector('img,[style*="background-image"]');
          }, {timeout:10000});
        }
        const thumbText=(await thumb.innerText().catch(()=>''))||'';
        if (thumbText.includes('대표이미지 추가') && await thumb.locator('img,[style*="background-image"]').count()===0) throw new Error('E_REPRESENTATIVE_UNVERIFIED');
      }
      await page.getByLabel('공개', {exact:true}).check();
      const publishButton = page.getByRole('button', {name:'공개 발행',exact:true});
      await publishButton.waitFor({state:'visible'});
      if (!(await publishButton.isEnabled())) throw new Error('E_PUBLISH_BUTTON_DISABLED');
      if (await page.locator('#post-title-inp').inputValue() !== post.title) throw new Error('E_TITLE_MISMATCH');
      // Durable checkpoint BEFORE the irreversible final click. A timeout must never resubmit blindly.
      const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
      const remoteMain = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], {encoding:'utf8'}).trim().split(/\s+/)[0] || '';
      if (!remoteMain || remoteMain !== sourceCommit) throw new Error('E_SOURCE_DRIFT');
      assertCurrentSource();
      await ledger.write(post.id, {phase:'submitting', fingerprint:fingerprint(post), sourceCommit, editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION, timestamp:new Date().toISOString()}, previousStateSha);
      stage = 'final-submit';
      finalSubmitDialogs = [];
      const submitResponses = [];
      const recordSubmitResponse = response => {
        try {
          if (response.request().method() !== 'POST') return;
          const u = new URL(response.url());
          submitResponses.push({host:u.host,path:u.pathname,status:response.status()});
        } catch {}
      };
      const readSubmitSignals = async () => {
        const notices = await page.locator('[role="alert"],.toast,.alert,.notice').evaluateAll(nodes => nodes
          .map(n => (n.textContent || '').replace(/\s+/g,' ').trim())
          .filter(Boolean).slice(0,8)).catch(()=>[]);
        const layerText = ((await page.locator('.publish_editor').innerText().catch(()=>'')) || '').replace(/\s+/g,' ').trim().slice(0,800);
        return {notices,layerText,dialogs:finalSubmitDialogs.slice(-8)};
      };
      const classifySubmitSignals = signals => {
        const text=[...(signals.notices||[]),...(signals.dialogs||[]).map(x=>x.message),signals.layerText||''].join(' ');
        if (/하루.{0,30}(?:공개|새롭게).{0,30}발행|최대\s*(?:15|30)개|공개\s*발행.{0,30}제한/.test(text)) return 'E_TISTORY_DAILY_PUBLISH_LIMIT';
        if (/자동입력|보안문자|captcha|recaptcha|사람인지|로봇/i.test(text)) return 'E_TISTORY_HUMAN_VERIFICATION_REQUIRED';
        if (submitResponses.some(x => /\/manage\/dkaptcha\//.test(x.path))) return 'E_TISTORY_HUMAN_VERIFICATION_REQUIRED';
        if (submitResponses.some(x => x.path === '/manage/post.json' && x.status === 403)) return 'E_TISTORY_HUMAN_VERIFICATION_REQUIRED';
        return null;
      };
      page.on('response', recordSubmitResponse);
      let navigatedToPostList = false;
      try {
        await publishButton.click({timeout:10000});
        await page.waitForTimeout(1200);
        const immediateSignals = await readSubmitSignals();
        console.log('FINAL_SUBMIT_RESPONSES '+JSON.stringify(submitResponses.slice(-12)));
        console.log('FINAL_SUBMIT_SIGNALS '+JSON.stringify(immediateSignals));
        const immediateCode=classifySubmitSignals(immediateSignals);
        if(immediateCode) throw new Error(immediateCode);
        try {
          await page.waitForURL(url => url.origin === BLOG && /\/manage\/posts\/?$/.test(url.pathname), {timeout:8000});
          navigatedToPostList = true;
        } catch {
          // Tistory may change its post-submit redirect without changing the write result.
          // Navigate read-only to the canonical post list and verify the exact title instead of clicking twice.
          await page.goto(`${BLOG}/manage/posts`, {waitUntil:'domcontentloaded'});
          navigatedToPostList = true;
        }
      } catch (error) {
        const signals = await readSubmitSignals();
        console.log('FINAL_SUBMIT_RESPONSES '+JSON.stringify(submitResponses.slice(-12)));
        console.log('FINAL_SUBMIT_SIGNALS '+JSON.stringify(signals));
        const signalCode=classifySubmitSignals(signals);
        if(signalCode) throw new Error(signalCode);
        if (/^E_[A-Z_]+$/.test(error?.message ?? '')) throw error;
        if (submitResponses.some(x => x.status === 429)) throw new Error('E_PUBLISH_RATE_LIMIT');
        if (submitResponses.some(x => x.status >= 400)) throw new Error('E_PUBLISH_HTTP');
        throw new Error('E_FINAL_SUBMIT_INTERACTION');
      } finally {
        page.off('response', recordSubmitResponse);
      }
      if (!navigatedToPostList) throw new Error('E_PUBLICATION_UNCERTAIN');
      const titleLink = page.locator('a').filter({hasText:post.title}).first();
      if (!(await titleLink.isVisible().catch(()=>false))) {
        const signals = await readSubmitSignals();
        console.log('FINAL_SUBMIT_POSTLIST '+JSON.stringify({urlPath:new URL(page.url()).pathname,signals}));
        const signalCode=classifySubmitSignals(signals);
        if(signalCode) throw new Error(signalCode);
        throw new Error('E_PUBLICATION_NOT_FOUND_AFTER_CLICK');
      }
      const publicUrls = await page.locator('a').evaluateAll((links, title) => [...new Set(links
        .filter(a => (a.textContent || '').trim() === title)
        .map(a => a.href)
        .filter(href => /^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(href)))], post.title);
      if (publicUrls.length !== 1) throw new Error('E_PUBLICATION_UNCERTAIN');
      const url = assertArticleUrl(publicUrls[0]);
      stage = 'public-verification';
      // Verify anonymously, so an owner-only/private page cannot count as published.
      publicBrowser = await openPublicBrowser(browserConfig);
      const publicContext = await verificationContext(publicBrowser);
      const publicPage = await publicContext.newPage();
      await publicPage.goto(url, {waitUntil:'domcontentloaded'});
      if (!(await publicPage.locator('body').innerText()).includes(post.title)) throw new Error('E_PUBLICATION_UNCERTAIN');
      const content = publicPage.locator('.contents_style');
      if (await content.count() !== 1) throw new Error('E_BODY_UNVERIFIED');
      const actual = (await content.innerText()).replace(/\s+/g,' ').trim();
      // Materialize the final editorial HTML in the browser and compare rendered innerText.
      // textContent collapses table cells and block boundaries differently from the live page,
      // which can create false E_BODY_UNVERIFIED failures even when the public article is complete.
      const expectedText = await publicPage.evaluate(html => {
        const host=document.createElement('div');
        host.setAttribute('aria-hidden','true');
        host.style.cssText='position:fixed;left:-100000px;top:0;width:800px;opacity:0;pointer-events:none;';
        host.innerHTML=html;
        document.body.appendChild(host);
        const text=(host.innerText||host.textContent||'').replace(/\s+/g,' ').trim();
        host.remove();
        return text;
      }, bodyHtml);
      if (!expectedText || actual !== expectedText) throw new Error('E_BODY_UNVERIFIED');
      if (sources.length) {
        const publicImages = await content.locator('img').evaluateAll(imgs => imgs.map(img => img.src));
        if (publicImages.length < sources.length || publicImages.slice(0, sources.length).some(src => !src.includes('kakaocdn.net'))) throw new Error('E_IMAGE_UNVERIFIED');
      }
      if (representativeSource) {
        const og = await publicPage.locator('meta[property="og:image"]').getAttribute('content').catch(()=>null);
        if (!og || og.includes('opengraph.png') || !og.includes('kakaocdn.net')) throw new Error('E_REPRESENTATIVE_UNVERIFIED');
      }
      const editorialSnapshot = await content.evaluate(root => {
        const h2=[...root.querySelectorAll('h2')];
        const h3=[...root.querySelectorAll('h3')];
        const accents=[...root.querySelectorAll('div[aria-hidden="true"]')].filter(x => {
          const s=x.getAttribute('style')||'';
          return /width:\s*34px/.test(s) && /height:\s*4px/.test(s);
        });
        const tables=[...root.querySelectorAll('table')];
        const tableWraps=tables.filter(t => {
          const p=t.parentElement;
          return p && /overflow-x:\s*auto/.test(p.getAttribute('style')||'');
        });
        const images=[...root.querySelectorAll('img')];
        const responsiveImages=images.filter(img => {
          const s=img.getAttribute('style')||'';
          return /width:\s*100%/.test(s) && /max-width:\s*720px/.test(s);
        });
        const priorityImages=images.filter(img => img.getAttribute('loading')==='eager' && img.getAttribute('fetchpriority')==='high');
        const highlights=[...root.querySelectorAll('span')].filter(x => /background:\s*linear-gradient\(transparent 45%,#[0-9a-f]{6} 45%\)/i.test(x.getAttribute('style')||''));
        const highlightColors=new Set(highlights.map(x => ((x.getAttribute('style')||'').match(/linear-gradient\(transparent 45%,(#[0-9a-f]{6}) 45%\)/i)||[])[1]).filter(Boolean).map(x=>x.toLowerCase()));
        const quickCards=[...root.querySelectorAll('p')].filter(p => /이것만 먼저 보세요$/.test(p.textContent.trim()) && /background:\s*#f7f9fc/.test(p.parentElement?.getAttribute('style')||''));
        const qs=[...root.querySelectorAll('span')].filter(x => x.textContent.trim()==='Q.');
        const as=[...root.querySelectorAll('span')].filter(x => x.textContent.trim()==='A.');
        const latest=[...root.querySelectorAll('div')].filter(x => /최신 근거\s*·?\s*\d{4}/.test(x.textContent) && /background:\s*#fbfcfe/.test(x.getAttribute('style')||''));
        const summary=[...h2].find(x=>x.textContent.trim()==='핵심 정리');
        const related=[...h2].find(x=>x.textContent.trim()==='함께 보면 좋은 글');
        const sources=[...h2].find(x=>x.textContent.trim()==='자료 출처');
        return {
          h2:h2.length,
          h2Styled:h2.filter(x=>/font-size:\s*26px/.test(x.getAttribute('style')||'')&&/font-weight:\s*800/.test(x.getAttribute('style')||'')).length,
          h3:h3.length,
          h3Styled:h3.filter(x=>/font-size:\s*20px/.test(x.getAttribute('style')||'')&&/font-weight:\s*800/.test(x.getAttribute('style')||'')).length,
          accents:accents.length,
          tables:tables.length,
          tableWraps:tableWraps.length,
          images:images.length,
          responsiveImages:responsiveImages.length,
          priorityImages:priorityImages.length,
          highlights:highlights.length,
          highlightColors:highlightColors.size,
          quickCards:quickCards.length,
          faqQ:qs.length,
          faqA:as.length,
          latest:latest.length,
          summaryBox:!!(summary?.nextElementSibling && /background:\s*#f8fafc/.test(summary.nextElementSibling.getAttribute('style')||'')),
          relatedCards:related ? (()=>{ let n=0,e=related.nextElementSibling; while(e&&e.tagName!=='H2'){ if(e.querySelector?.('a[style*="text-decoration:none"]')) n++; e=e.nextElementSibling; } return n; })() : 0,
          sourcesStyled:!!(sources?.nextElementSibling && sources.nextElementSibling.tagName==='UL' && /font-size:\s*14px/.test(sources.nextElementSibling.getAttribute('style')||''))
        };
      });
      if (
        editorialSnapshot.h2 !== editorialExpected.h2 ||
        editorialSnapshot.h2Styled !== editorialExpected.h2 ||
        editorialSnapshot.accents !== editorialExpected.h2 ||
        editorialSnapshot.h3 !== editorialExpected.h3 ||
        editorialSnapshot.h3Styled !== editorialExpected.h3 ||
        editorialSnapshot.tables !== editorialExpected.tables ||
        editorialSnapshot.tableWraps !== editorialExpected.tables ||
        editorialSnapshot.images !== editorialExpected.images ||
        editorialSnapshot.responsiveImages !== editorialExpected.images ||
        (editorialExpected.images > 0 && editorialSnapshot.priorityImages < 1) ||
        editorialSnapshot.highlights !== editorialExpected.highlights ||
        (editorialExpected.highlights >= 2 && editorialSnapshot.highlightColors < 2) ||
        editorialSnapshot.quickCards !== editorialExpected.quick ||
        editorialSnapshot.faqQ !== editorialExpected.faq ||
        editorialSnapshot.faqA !== editorialExpected.faq ||
        editorialSnapshot.latest !== editorialExpected.latest ||
        (editorialExpected.summary && !editorialSnapshot.summaryBox) ||
        (editorialExpected.related && editorialSnapshot.relatedCards !== editorialExpected.relatedLinks) ||
        (editorialExpected.sources && !editorialSnapshot.sourcesStyled)
      ) throw new Error('E_EDITORIAL_PUBLIC_CONTRACT');
      const state = await ledger.read(post.id);
      if (state?.phase !== 'submitting' || state.fingerprint !== fingerprint(post)) throw new Error('E_LEDGER_CONFLICT');
      await ledger.write(post.id, {phase:'published',fingerprint:fingerprint(post),url,editorialTemplateVersion:EDITORIAL_TEMPLATE_VERSION,timestamp:new Date().toISOString()}, state.sha);
      console.log(`PUBLISHED: ${post.id} ${url}`);
    } else console.log('NO_PENDING_POSTS');
  }
} catch (error) {
  const code = /^(?:E_[A-Z_]+|BLOCKED_SOURCE_DRIFT)$/.test(error?.message ?? '') ? error.message : 'E_RUNTIME';
  console.error(`DIAGNOSTIC: ${stage} ${code}`);
  console.error('RUNTIME_SAFE_DIAG '+JSON.stringify(safeRuntimeDiagnostic(error)));
  if (editorPage && stage === 'mode-menu') try {
    console.log('MODE_MENU_SAFE_DIAG '+JSON.stringify(await editorPage.evaluate(()=>{
      const buttons=[...document.querySelectorAll('#editor-mode-layer-btn-open')];
      return { count:buttons.length, buttons:buttons.map(button=>{
        const rect=button.getBoundingClientRect();
        const x=rect.left+rect.width/2, y=rect.top+rect.height/2;
        const hit=document.elementFromPoint(x,y);
        return {visible:rect.width>0&&rect.height>0,disabled:button.disabled,
          insideViewport:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,
          hitWithinButton:!!hit&&(hit===button||button.contains(hit)),
          hitTag:hit?.tagName??null};
      })};
    })));
  } catch { console.log('MODE_MENU_SAFE_DIAG_UNAVAILABLE'); }
  if (stage === 'local-browser') console.error('LOCAL_BROWSER_SAFE_DIAG '+JSON.stringify({code}));
  if (editorPage && stage !== 'final-submit' && stage !== 'public-verification') try {
    console.log('EDITOR_CONTROLS: '+JSON.stringify(await editorPage.evaluate(()=>({
      codeMirror:document.querySelectorAll('.CodeMirror').length,
      codeMirrorCode:document.querySelectorAll('.CodeMirror-code').length,
      inputs:Array.from(document.querySelectorAll('textarea')).map(e=>({id:e.id,class:e.className})),
      modeText:document.querySelector('#editor-mode-layer-btn-open')?.textContent,
    }))));
  } catch {}
  // Provider exceptions can carry credentials/connect URLs: never log raw exceptions.
  console.error('STOP: 로컬 Chrome·전용 프로필·로그인·발행 증거를 확인해야 합니다. 실패 직후 임의 재발행하지 마세요.');
  process.exitCode = 1;
  fatalExitCode = 1;
} finally {
  try { await publicBrowser?.close(); }
  catch { console.error('E_LOCAL_PUBLIC_BROWSER_CLOSE'); process.exitCode = 1; }
  try { await closeEditorConnection(editorConnection); }
  catch { console.error('E_LOCAL_BROWSER_DISCONNECT'); process.exitCode = 1; }
  if (imageTempDir) try { await rm(imageTempDir, {recursive:true, force:true}); }
  catch { console.error('E_LOCAL_TEMP_CLEANUP'); process.exitCode = 1; fatalExitCode = 1; }
  if (fatalExitCode) setTimeout(() => process.exit(fatalExitCode), 0);
}
