import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeRuntimeDiagnostic, hasHumanVerificationFailure } from '../publishing/runtime-diagnostics.mjs';
import { ensureEditorRendering } from '../publishing/local-browser.mjs';

test('successful widget and publication responses are not human verification failures',()=>{
  assert.equal(hasHumanVerificationFailure([
    {path:'/manage/dkaptcha/widgetId',status:200},
    {path:'/manage/post.json',status:200},
  ]),false);
  assert.equal(hasHumanVerificationFailure([{path:'/manage/dkaptcha/widgetId',status:403}]),true);
  assert.equal(hasHumanVerificationFailure([{path:'/manage/post.json',status:403}]),true);
});

test('editor rendering correction targets its own CDP session and fails closed',async()=>{
  const page={};
  const calls=[];
  const session={send:async(...args)=>calls.push(args)};
  const context={newCDPSession:async target=>{assert.equal(target,page);return session;}};
  assert.equal(await ensureEditorRendering(context,page),session);
  assert.deepEqual(calls,[['Emulation.setFocusEmulationEnabled',{enabled:true}]]);
  await assert.rejects(ensureEditorRendering({newCDPSession:async()=>{throw Error('secret');}},page),/^Error: E_EDITOR_RENDERING$/);
});

test('publisher entry point parses before any browser or external mutation',()=>{
  execFileSync(process.execPath,['--check',fileURLToPath(new URL('../publishing/publish.mjs',import.meta.url))]);
});

test('runtime diagnostics classify click blockers without echoing sensitive exceptions',()=>{
  const error=new Error('Timeout 20000ms exceeded: overlay intercepts pointer events https://example.invalid/?token=private-secret Authorization: private-secret');
  error.name='TimeoutError';
  const result=safeRuntimeDiagnostic(error);
  assert.equal(result.type,'TIMEOUT');
  assert.equal(result.timeout,true);
  assert.equal(result.pointerIntercepted,true);
  assert.doesNotMatch(JSON.stringify(result),/private-secret|example|Authorization/);
  assert.equal(safeRuntimeDiagnostic(new Error('Target page, context or browser has been closed')).closed,true);
  assert.equal(safeRuntimeDiagnostic(new Error('Element is outside of the viewport')).outsideViewport,true);
  assert.equal(safeRuntimeDiagnostic(null).timeout,false);
});
