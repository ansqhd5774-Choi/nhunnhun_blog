import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEditorMode} from '../publishing/update-editor-controls.mjs';

function fakePage({transition=true,control=true}={}){
  let editor=false;
  const page={
    locator(selector){
      if(selector==='.CodeMirror:visible')return {count:async()=>0};
      if(selector.includes(':visible'))return {first:()=>({
        isVisible:async()=>false,
        waitFor:async()=>{throw new Error('hidden toolbar')},
      })};
      throw new Error('unexpected selector '+selector);
    },
    async evaluate(fn,...args){
      if(!control)return null;
      if(String(fn).includes('const ids='))return {path:'/manage/newpost/233',controls:[],codeMirror:1};
      if(String(fn).includes("for(const id of ['editor-mode-html'")){if(transition)editor=true;return 'editor-mode-html'}
      throw new Error('unexpected DOM evaluation');
    },
    async waitForFunction(fn,args,options){assert.equal(options.timeout,10000);if(!editor)throw new Error('not transitioned')},
  };
  return page;
}

test('hidden HTML menu invokes only known DOM control and checks CodeMirror transition',async()=>{
  await selectEditorMode(fakePage(),'html');
});
test('hidden HTML menu cannot bypass transition gate',async()=>{
  await assert.rejects(selectEditorMode(fakePage({transition:false}),'html'),/E_UPDATE_EDITOR_MODE_TRANSITION/);
});
test('hidden HTML menu without control fails before any submission',async()=>{
  await assert.rejects(selectEditorMode(fakePage({control:false}),'html'),/E_UPDATE_EDITOR_MODE_MENU/);
});
