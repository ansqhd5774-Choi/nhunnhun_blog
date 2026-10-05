import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { safeRuntimeDiagnostic } from '../publishing/runtime-diagnostics.mjs';

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
