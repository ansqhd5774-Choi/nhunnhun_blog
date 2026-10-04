import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { BLOG, checkPublishHtml, plainText } from './core.mjs';

const ALLOWED=['id','articleId','targetUrl','expectedCurrentTitle','title','representativeImageUrl','imageReview','bodyHtml','status','approved'];

export function checkUpdateSource(update, filename){
  if(!update || typeof update!=='object' || Array.isArray(update) || Object.keys(update).some(k=>!ALLOWED.includes(k))) throw new Error('E_UPDATE_SCHEMA');
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(update.id) || filename!==`${update.id}.json`) throw new Error('E_UPDATE_ID');
  if(!/^\d+$/.test(update.articleId||'')) throw new Error('E_UPDATE_ARTICLE');
  if(update.targetUrl!==`${BLOG}/${update.articleId}`) throw new Error('E_UPDATE_URL');
  for(const key of ['expectedCurrentTitle','title']){
    if(typeof update[key]!=='string' || !update[key].trim() || update[key].length>150 || /[\r\n]/.test(update[key])) throw new Error('E_UPDATE_TITLE');
  }
  if(update.status!=='ready' || update.approved!==true) throw new Error('E_UPDATE_APPROVAL');
  if(typeof update.bodyHtml!=='string' || !plainText(update.bodyHtml)) throw new Error('E_UPDATE_BODY');
  if(typeof update.representativeImageUrl!=='string' || !update.representativeImageUrl.trim()) throw new Error('E_UPDATE_REPRESENTATIVE');
  let rep;
  try { rep=new URL(update.representativeImageUrl); } catch { throw new Error('E_UPDATE_REPRESENTATIVE'); }
  if(rep.protocol!=='https:' || rep.username || rep.password) throw new Error('E_UPDATE_REPRESENTATIVE');
  checkPublishHtml({bodyHtml:update.bodyHtml});
  return update;
}
export function updateFingerprint(update){
  return createHash('sha256').update(JSON.stringify([
    update.id,update.articleId,update.targetUrl,update.expectedCurrentTitle,update.title,update.representativeImageUrl,update.bodyHtml
  ])).digest('hex');
}
export async function loadUpdates(directory='updates'){
  const out=[];
  for(const name of (await readdir(directory)).filter(n=>n.endsWith('.json')).sort()){
    out.push(checkUpdateSource(JSON.parse(await readFile(`${directory}/${name}`,'utf8')),name));
  }
  if(new Set(out.map(x=>x.articleId)).size!==out.length) throw new Error('E_UPDATE_DUPLICATE_ARTICLE');
  return out;
}
export function eligibleUpdate(update,state){
  if(update.status!=='ready' || !update.approved) return false;
  if(!state) return true;
  if(state.phase==='updated' && state.fingerprint===updateFingerprint(update) && state.url===update.targetUrl) return false;
  throw new Error('E_UPDATE_EXISTING_STATE_REQUIRES_REVIEW');
}
