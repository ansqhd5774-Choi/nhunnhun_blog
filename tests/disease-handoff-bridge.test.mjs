import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHandoff,sha256} from '../authoring/sync-disease-updates.mjs';

const filename='direct-397-flu-return-20261022.json';
const valid=JSON.parse(readFileSync(new URL('../updates/'+filename,import.meta.url),'utf8'));
test('approved existing disease source passes shared submission preflight',()=>{
 assert.equal(validateHandoff(valid,filename).articleId,'397');
});
test('bridge refuses unapproved, wrong-category and new-publication sources',()=>{
 for(const changed of [
  {...valid,approved:false},
  {...valid,category:'음식'},
  {...valid,contentStandard:'R1'},
  {...valid,articleId:undefined}
 ])assert.throws(()=>validateHandoff(changed,filename),/E_DISEASE_BRIDGE_/);
 assert.throws(()=>validateHandoff(valid,'direct-another-id.json'),/E_DISEASE_BRIDGE_ID/);
});
test('full source byte digest is stable and detects any change',()=>{
 assert.equal(sha256('hello'),sha256('hello'));
 assert.notEqual(sha256('hello'),sha256('hello '));
});
