import {ALT_OPERATION,validateAltMaintenance,maintenanceHash} from './alt-maintenance-contract.mjs';
const keys=['id','articleId','targetUrl','expectedCurrentTitle','title','status','approved','operation','maintenance'];
export const isAltMaintenance=s=>s?.operation===ALT_OPERATION;
export function checkAltSource(s,filename){
  if(!s||Object.keys(s).length!==keys.length||keys.some(k=>!Object.hasOwn(s,k)))throw Error('E_ALT_SOURCE_SCHEMA');
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(s.id)||filename!==s.id+'.json')throw Error('E_UPDATE_ID');
  if(s.status!=='ready'||s.approved!==true)throw Error('E_UPDATE_APPROVAL');
  validateAltMaintenance(s.maintenance);
  if(s.operation!==ALT_OPERATION||s.articleId!==s.maintenance.articleId||s.targetUrl!==`https://nhunnhun.tistory.com/${s.articleId}`||s.title!==s.maintenance.expectedTitle||s.expectedCurrentTitle!==s.title)throw Error('E_ALT_SOURCE_TARGET');
  return s;
}
export const altFingerprint=s=>maintenanceHash(JSON.stringify([s.id,s.articleId,s.targetUrl,s.operation,s.maintenance]));
