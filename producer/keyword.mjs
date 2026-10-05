import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {discoverKeyword,FOOD_CATALOG} from './discovery.mjs';
import {selectImages} from './image-selection.mjs';
import {atomicJson,artifactPath} from './artifacts.mjs';
// Reviewed research profiles are separate from generated drafts and publication approval.
// No arbitrary URL, approval field or command is derived from a keyword.
export function normalizeKeyword(value){if(typeof value!=='string'||value.trim().length<1||value.length>100||/[\r\n<>]/.test(value))throw new Error('E_KEYWORD');return value.normalize('NFKC').replace(/\s+/g,' ').trim();}
export async function assertSupportedKeyword(topic,runtime){
  const keyword=normalizeKeyword(topic);if(FOOD_CATALOG[keyword])return keyword;
  let profiles=[];try{profiles=JSON.parse(await readFile(join(runtime,'research-profiles.json'),'utf8')).profiles??[];}catch{}
  if(!profiles.some(p=>p.keywords?.includes(keyword)&&p.reviewed===true&&Date.parse(p.expires_at)>Date.now()))throw new Error('BLOCKED_UNSUPPORTED_KEYWORD');
  return keyword;
}
export async function keywordManifest(job,runtime,{signal,relatedLinks=[]}={}){
  const linked=manifest=>({...manifest,internal_links:manifest.internal_links?.length?manifest.internal_links:relatedLinks});
  if(job.payload.manifest)return linked(job.payload.manifest);
  const keyword=normalizeKeyword(job.topic);
  let catalog;try{catalog=JSON.parse(await readFile(join(runtime,'research-profiles.json'),'utf8'));}catch{catalog={profiles:[]};}
  const profile=catalog.profiles?.find(p=>p.keywords?.includes(keyword));
  if(profile&&profile.reviewed===true&&profile.expires_at&&Date.parse(profile.expires_at)>Date.now())return linked(profile.manifest);
  if(!relatedLinks.length)throw new Error('BLOCKED_RELATED_LINKS');
  const discovery=await discoverKeyword(keyword,{signal});
  await atomicJson(artifactPath(runtime,job.job_id,'discovery.json'),discovery);
  const imageReviews=[];
  const selected=await selectImages(discovery,{signal,onReview:async result=>{imageReviews.push(result);await atomicJson(artifactPath(runtime,job.job_id,'image-review-progress.json'),imageReviews);}});
  await atomicJson(artifactPath(runtime,job.job_id,'image-selection.json'),selected);
  return linked(selected);
}
