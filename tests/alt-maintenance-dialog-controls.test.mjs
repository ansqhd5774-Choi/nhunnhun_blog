import test from 'node:test';
import assert from 'node:assert/strict';
import {altDialogControl,cancelAltDialog} from '../publishing/alt-maintenance-dialog-controls.mjs';
function footerPage({panels=1,cancels=1,submits=1,enabled=true}={}){
  const events=[];
  const counts={'.publish_editor:visible':panels,'.publish_editor button:visible':0,'#unpublish-btn:visible':cancels,'#publish-btn:visible':submits};
  const locator=(selector,name)=>({count:async()=>counts[selector]??0,isEnabled:async()=>enabled,
    and(other){return locator(other.selector,name);},selector,
    click:async()=>events.push(name),waitFor:async options=>events.push(options.state)});
  return {events,locator:selector=>locator(selector),getByRole:(_,{name})=>locator('',name)};
}
test('sibling footer cancel is selected once and disappearance is awaited',async()=>{
  const page=footerPage();assert.equal(await page.locator('.publish_editor button:visible').count(),0);
  await cancelAltDialog(page);assert.deepEqual(page.events,['취소','hidden']);
});
test('same observed footer submit ID resolves without clicking',async()=>{
  const page=footerPage();await altDialogControl(page,'submit');assert.deepEqual(page.events,[]);
});
test('missing or ambiguous visible panel/control and disabled control fail closed',async()=>{
  for(const options of [{panels:0},{panels:2},{cancels:0},{cancels:2},{enabled:false}]){
    const page=footerPage(options);await assert.rejects(cancelAltDialog(page),/E_ALT_(DIALOG|CANCEL)_CONTROL/);assert.deepEqual(page.events,[]);
  }
  for(const submits of [0,2])await assert.rejects(altDialogControl(footerPage({submits}),'submit'),/E_ALT_SUBMIT_CONTROL/);
});
