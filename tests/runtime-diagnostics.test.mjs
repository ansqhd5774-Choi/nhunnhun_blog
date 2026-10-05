import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRuntimeDiagnostic } from '../publishing/runtime-diagnostics.mjs';

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
