import https from 'node:https';
import dns from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { assertImagePayload } from '../publishing/verify-updated-public.mjs';
import { plainText } from '../publishing/core.mjs';
import {publicArticleTitle} from './article-title.mjs';
export const PUBLIC_HOSTS=['nodejs.org','docs.ollama.com','ollama.com','nih.gov','pubmed.ncbi.nlm.nih.gov','fda.gov','foodsafety.gov','cdc.gov','who.int','nhunnhun.tistory.com','commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org','creativecommons.org','nutritionsource.hsph.harvard.edu'];
export function publicIPv4(address){
  const a=address.split('.').map(Number);if(a.length!==4||a.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&[18,19].includes(a[1])||a[0]===192&&a[1]===0||a[0]===198&&a[1]===51&&a[2]===100||a[0]===203&&a[1]===0&&a[2]===113);
}
export function publicUrl(value,hosts=PUBLIC_HOSTS){
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||/[?&](token|key|api_key|access_token|password)=/i.test(u.search))throw new Error('E_RESEARCH_URL');
  if(u.hostname==='nhunnhun.tistory.com'&&!/^\/(?:\d+|sitemap\.xml|rss|robots\.txt)?$/.test(u.pathname))throw new Error('E_RESEARCH_URL');
  return u;
}
export async function request(value,{signal,limit=2*1024*1024,followRedirects=true}={},redirects=0){
  const u=publicUrl(value);if(redirects>3)throw new Error('E_RESEARCH_REDIRECT');
  // Pin the checked public IPv4 address for this request; do not resolve again at connection time.
  const addresses=await dns.lookup(u.hostname,{all:true,family:4});
  if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw new Error('E_RESEARCH_DNS');
  const result=await new Promise((resolve,reject)=>{
    const req=https.get(u,{signal,timeout:20000,headers:{'User-Agent':'NHUNNHUN-Producer/1.0 (+https://nhunnhun.tistory.com/)','Accept':'text/html,application/rss+xml,application/xml,image/*,text/plain;q=0.9,*/*;q=0.5'},lookup:(_host,options,callback)=>options?.all?callback(null,[addresses[0]]):callback(null,addresses[0].address,4)},res=>{
      const chunks=[];let length=0;
      res.on('data',chunk=>{length+=chunk.length;if(length>limit){res.destroy(new Error('E_RESEARCH_SIZE'));return;}chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks),url:u.href}));
    });
    req.on('timeout',()=>req.destroy(new Error('E_RESEARCH_TIMEOUT')));req.on('error',reject);
  });
  if(followRedirects&&[301,302,303,307,308].includes(result.status))return request(new URL(result.headers.location,u).href,{signal,limit,followRedirects},redirects+1);
  if([429,503].includes(result.status))throw new Error('E_RESEARCH_RATE_LIMIT');
  return result;
}
export function robotsAllows(text,path){
  const groups=[];let agents=[],rules=[],started=false;
  const finish=()=>{if(agents.length)groups.push({agents,rules});agents=[];rules=[];started=false;};
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim(),match=line.match(/^([^:]+):\s*(.*)$/);if(!match)continue;
    const key=match[1].trim().toLowerCase(),value=match[2].trim();
    if(key==='user-agent'){if(started)finish();agents.push(value.toLowerCase());}
    else if(['allow','disallow'].includes(key)&&agents.length){started=true;if(value)rules.push({allow:key==='allow',pattern:value});}
  }
  finish();
  const own=groups.filter(g=>g.agents.some(a=>a!=='*'&&'nhunnhun-producer'.startsWith(a)));
  const selected=own.length?own:groups.filter(g=>g.agents.includes('*'));
  const matching=selected.flatMap(g=>g.rules).filter(r=>{
    const end=r.pattern.endsWith('$'),pattern=end?r.pattern.slice(0,-1):r.pattern;
    const re='^'+pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+(end?'$':'');
    return new RegExp(re).test(path);
  }).sort((a,b)=>b.pattern.length-a.pattern.length||Number(b.allow)-Number(a.allow));
  return !matching.length||matching[0].allow;
}
export function dimensions(bytes){
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.length>=24)return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii'))&&bytes.length>=10)return {width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};
  if(bytes[0]===255&&bytes[1]===216){
    let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue;}const marker=bytes[i+1];if([0xc0,0xc1,0xc2,0xc3].includes(marker))return {width:bytes.readUInt16BE(i+7),height:bytes.readUInt16BE(i+5)};if([0xd8,0xd9].includes(marker)){i+=2;continue;}const length=bytes.readUInt16BE(i+2);if(length<2)break;i+=length+2;}
  }
  if(bytes.length>=30&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,16).toString('ascii')==='WEBPVP8X')return {width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
  throw new Error('BLOCKED_IMAGES');
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const normalize=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
export function publicReader({signal,read=request}={}){
  const robots=new Map();
  return async function allowedRead(value,limit=2*1024*1024){
    let u=publicUrl(value);
    for(let redirects=0;redirects<=3;redirects++){
      if(!robots.has(u.origin)){
        const r=await read(u.origin+'/robots.txt',{signal,limit:500000});
        if(r.status!==404&&r.status!==200)throw new Error('E_RESEARCH_ROBOTS');
        robots.set(u.origin,r.status===404?'':r.bytes.toString('utf8'));
      }
      if(!robotsAllows(robots.get(u.origin),u.pathname+u.search))throw new Error('E_RESEARCH_ROBOTS');
      const result=await read(u.href,{signal,limit,followRedirects:false});
      if([301,302,303,307,308].includes(result.status)){u=publicUrl(new URL(result.headers.location,u).href);continue;}
      if(result.status!==200)throw new Error('E_RESEARCH_HTTP');
      if(result.url!==u.href)throw new Error('E_RESEARCH_UNCHECKED_REDIRECT');
      return result;
    }
    throw new Error('E_RESEARCH_REDIRECT');
  };
}
export function manifestGate(manifest){
  if(!manifest||!Array.isArray(manifest.sources)||manifest.sources.length<2)throw new Error('BLOCKED_EVIDENCE');
  if(!Array.isArray(manifest.images)||manifest.images.length<3)throw new Error('BLOCKED_IMAGES');
  if(manifest.sources.some(s=>!s.title||!s.institution||!s.url||!s.published_at||!Array.isArray(s.claims)||!s.claims.length||s.claims.some(c=>!/^c[a-z0-9-]+$/.test(c.id??'')||!c.text||!c.excerpt||c.excerpt.length>1200||c.reviewed!==true)))throw new Error('BLOCKED_EVIDENCE');
  if(manifest.images.some(i=>!i.original_page_url||!i.https_asset_url||!i.author||!i.license_url||!['CC0','PUBLIC_DOMAIN','CC-BY-4.0','CC-BY-SA-4.0'].includes(i.license)||i.rights_reviewed!==true||!i.alt?.trim()||!i.placement))throw new Error('BLOCKED_IMAGES');
  const ids=manifest.sources.flatMap(s=>s.claims.map(c=>c.id));if(new Set(ids).size!==ids.length)throw new Error('BLOCKED_EVIDENCE');
  return manifest;
}
export async function collectEvidence({job,signal},{read=request}={}){
  const manifest=manifestGate(job.payload.manifest);const allowedRead=publicReader({signal,read});
  const sources=[];
  for(const [n,s] of manifest.sources.entries()){
    const result=await allowedRead(s.url,2*1024*1024),text=plainText(result.bytes.toString('utf8'));
    if(s.claims.some(c=>!normalize(text).includes(normalize(c.excerpt))))throw new Error('BLOCKED_EVIDENCE');
    sources.push({source_id:'s'+n,url:s.url,final_url:result.url,title:s.title,institution:s.institution,published_at:s.published_at,retrieved_at:new Date().toISOString(),http_status:result.status,content_hash:sha(result.bytes),claims:s.claims});
  }
  const images=[];
  for(const i of manifest.images){
    const page=await allowedRead(i.original_page_url,2*1024*1024);
    const license=await allowedRead(i.license_url,2*1024*1024);
    const result=await allowedRead(i.https_asset_url,12*1024*1024),bytes=assertImagePayload(result.headers['content-type'],result.bytes);
    if(i.file_hash&&i.file_hash!==sha(bytes))throw new Error('BLOCKED_IMAGES');
    const size=dimensions(bytes);if(size.width<300||size.height<200)throw new Error('BLOCKED_IMAGES');
    images.push({...i,...size,file_hash:sha(bytes),original_page_hash:sha(page.bytes),license_page_hash:sha(license.bytes),retrieved_at:new Date().toISOString()});
  }
  if(new Set(images.map(i=>i.file_hash)).size<3)throw new Error('BLOCKED_IMAGES');
  const internal_links=[];
  for(const link of manifest.internal_links??[]){
    if(!/^https:\/\/nhunnhun\.tistory\.com\/\d+$/.test(link.url)||!link.title||link.relevance_reviewed!==true||!link.relevance_reason?.trim())throw new Error('BLOCKED_EVIDENCE');
    const result=await allowedRead(link.url,2*1024*1024);
    if(result.url!==link.url||publicArticleTitle(result.bytes.toString('utf8'))!==link.title.replace(/\s+/g,' ').trim())throw new Error('E_INTERNAL_LINK_TITLE');
    internal_links.push({...link,http_status:result.status,content_hash:sha(result.bytes),retrieved_at:new Date().toISOString()});
  }
  return {sources,images,internal_links,quantities:manifest.quantities??[],fact_review:'MANIFEST_REVIEWED_CLAIMS_ONLY',copyright_review:'USER_REVIEWED_MANIFEST; HTTP existence is not independent legal proof',search_intent_review:manifest.search_intent_review??'PENDING',medical_review:manifest.medical_review??'PENDING'};
}
