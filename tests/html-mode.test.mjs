import test from 'node:test';
import assert from 'node:assert/strict';
import { openHtmlMode } from '../publishing/html-mode.mjs';

function fixture({menuOpen=false,alreadyHtml=false,menuFails=false,modeFails=false}={}) {
  const events=[];
  let ready=false;
  const menu={click:async()=>{events.push('menu-click');}};
  const html={isVisible:async()=>menuOpen,waitFor:async()=>{
    events.push('menu-visible'); if(menuFails)throw Error('timeout'); ready=true;
  },click:async()=>{assert.equal(ready,true);events.push('html-click');}};
  const editor={isVisible:async()=>alreadyHtml,waitFor:async()=>{
    events.push('editor-visible');if(modeFails)throw Error('timeout');
  }};
  return {events,page:{locator:s=>({'#editor-mode-layer-btn-open':menu,'#editor-mode-html':html,'.CodeMirror:visible':editor})[s]}};
}
test('closed menu is clicked once, then waits for dropdown and HTML editor',async()=>{
  const f=fixture();await openHtmlMode(f.page,()=>{},()=>{});
  assert.deepEqual(f.events,['menu-click','menu-visible','html-click','editor-visible']);
});
test('open menu is never toggled closed and existing HTML mode is preserved',async()=>{
  const f=fixture({menuOpen:true});await openHtmlMode(f.page,()=>{},()=>{});
  assert.deepEqual(f.events,['menu-visible','html-click','editor-visible']);
  const ready=fixture({alreadyHtml:true});await openHtmlMode(ready.page,()=>{},()=>{});
  assert.deepEqual(ready.events,[]);
});
test('menu timeout does not cause a second click or body editing',async()=>{
  const f=fixture({menuFails:true});await assert.rejects(openHtmlMode(f.page,()=>{},()=>{}));
  assert.deepEqual(f.events,['menu-click','menu-visible']);
});
test('unconfirmed mode switch stops before body editing with a specific error',async()=>{
  const f=fixture({modeFails:true});await assert.rejects(openHtmlMode(f.page,()=>{},()=>{}),/^Error: E_HTML_MODE_NOT_ACTIVATED$/);
});
