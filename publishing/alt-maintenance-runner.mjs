import {applyAltMaintenance,maintenanceHash} from './alt-maintenance-contract.mjs';
import {observeAltMetadata,assertObservedMetadataPreserved} from './alt-maintenance-observe.mjs';
import {altFingerprint} from './alt-maintenance-source.mjs';
import {preparePublishEditor,openPublishDialog} from './publish-dialog.mjs';

// Existing update entry point supplies its source gate, editor mode and ledger.
// This operation never renders an article, uploads an image, or edits metadata.
export async function runAltMaintenance({page,source,originalHtml,selectMode,ledger,assertSource,
  capturePublicBaseline,finalize,log=console.log,
  prepare=preparePublishEditor,open=openPublishDialog,observe=observeAltMetadata}){
  if(await ledger.read(source.id))throw Error('E_UPDATE_EXISTING_STATE_REQUIRES_REVIEW');
  await prepare(page,{title:source.title});
  await open(page,{title:source.title},log,'E_ALT_DIALOG');
  const before=await observe(page);
  // Only existing public articles are in scope. Protected/private never become public.
  if(before.metadata.visibility!=='20')throw Error('E_ALT_PUBLIC_VISIBILITY_REQUIRED');
  const changed=applyAltMaintenance(originalHtml,before.metadata,source.maintenance);
  const cancel=page.getByRole('button',{name:'취소',exact:true}).and(page.locator('.publish_editor button:visible'));
  if(await cancel.count()!==1)throw Error('E_ALT_CANCEL_CONTROL');
  await cancel.click();
  await page.locator('.publish_editor').waitFor({state:'hidden',timeout:10000});
  // Anonymous baseline is collected before any content staging, not inferred from HTTP 200.
  const baseline=await capturePublicBaseline(originalHtml,source,before.metadata);
  await selectMode(page,'html');
  const code=page.locator('.CodeMirror:visible .CodeMirror-code');
  await code.waitFor({state:'visible'});
  await code.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(changed.targetHtml);
  const staged=await page.locator('.CodeMirror:visible').evaluate(el=>el?.CodeMirror?.getValue?.()||'');
  if(maintenanceHash(staged)!==changed.targetBodySha256)throw Error('E_ALT_STAGED_BODY_DRIFT');
  await prepare(page,{title:source.title});
  await open(page,{title:source.title},log,'E_ALT_DIALOG');
  const after=await observe(page);
  assertObservedMetadataPreserved(before,after);
  const submit=page.getByRole('button',{name:'공개 발행',exact:true}).and(page.locator('.publish_editor button:visible'));
  if(await submit.count()!==1||!await submit.isEnabled())throw Error('E_ALT_SUBMIT_CONTROL');
  const sourceCommit=assertSource();
  // Re-read immediately before checkpoint; no re-submit when a previous run exists.
  if(await ledger.read(source.id))throw Error('E_UPDATE_EXISTING_STATE_REQUIRES_REVIEW');
  await ledger.write(source.id,{phase:'submitting',operation:source.operation,fingerprint:altFingerprint(source),
    url:source.targetUrl,articleId:source.articleId,sourceCommit,baseline,
    originalBodySha256:changed.originalBodySha256,targetBodySha256:changed.targetBodySha256,
    metadataSha256:after.sha256,timestamp:new Date().toISOString(),semanticVerification:'alt-visual-review-only'});
  // Exactly one final submit. Exceptions leave submitting for read-only recovery.
  await submit.click();
  log('SUBMIT_CLICKED: '+source.id+' '+source.targetUrl);
  return finalize(source.id);
}
