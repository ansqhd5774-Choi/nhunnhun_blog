// Isolated C996 fixed-owner read-only verification. No ACL, VM, DISM, or source modifications.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = String.raw`C:\Users\ansqh\AppData\Local\Temp\C996_ISO_R5_80f18cafcbd44c82af95082138eb51e7`;
const ATTEMPT = path.win32.join(ROOT, 'ISO_ATTEMPT_187cd12b4d2a4789b9ef549ba9cda886');
const FILES = Object.freeze([
  ['FINAL_WIM',path.win32.join(ATTEMPT,'WinPE_amd64','media','sources','boot.wim'),'e1397e3ea4e49ee08981fc210415b66b534b2358343ce7e985b996df84d17dbe'],
  ['TEST_ISO',path.win32.join(ATTEMPT,'iso','C996_WINPE_CNG_TEST_ONLY.iso'),'63d6dccf67e470c28842cc3eccbcd552275588b921a969a076d6fe4788e4c588'],
  ['BIOS_BCD',path.win32.join(ATTEMPT,'WinPE_amd64','media','Boot','BCD'),'ba146660b06aedbea6e5892378569507c7c3b9387c7bd06a33d58d0fb7dfaa94'],
  ['UEFI_BCD',path.win32.join(ATTEMPT,'WinPE_amd64','media','EFI','Microsoft','Boot','BCD'),'877fa52824b660d096aa79263bb150058ea77b1d59f8fc4804ae2fa42708b2a9']
]);
const LOGDIRS = Object.freeze([
  ['R5_ROOT',ROOT],['ISO_ATTEMPT',ATTEMPT],
  ['ISO_LOGS',path.win32.join(ATTEMPT,'logs')],
  ['R5_LOGS',path.win32.join(ROOT,'logs')]
]);
const EVIDENCE = Object.freeze([
  ['ISO_RESULT',path.win32.join(ATTEMPT,'result.json')],
  ['FINAL_INDEX_1',path.win32.join(ATTEMPT,'FINAL_INDEX_1.txt')],
  ['MAKE_ISO',path.win32.join(ATTEMPT,'make-iso.txt')],
  ['MOUNT_STATUS',path.win32.join(ATTEMPT,'MOUNT_STATUS.txt')],
  ['DISCARD_RESULT',path.win32.join(ROOT,'cleanup-result.json')],
  ['ISO_PASS',path.win32.join(ROOT,'ISO_ONLY_PASS.json')]
]);
function errorCode(err){
  return ['EACCES','EPERM','ENOENT','ENOTDIR'].includes(err?.code)?err.code:'UNAVAILABLE';
}
function noLink(file,stat=fs.lstatSync){
  let p=path.win32.resolve(file);
  for(;;){
    const s=stat(p);
    if(s.isSymbolicLink())throw Object.assign(new Error('REPARSE_STOP'),{code:'REPARSE_STOP'});
    const parent=path.win32.dirname(p);
    if(parent===p)break;
    p=parent;
  }
  return stat(file);
}
export function authorizedOwnerContext({platform=process.platform,host=os.hostname(),user=os.userInfo().username,runner=process.env.RUNNER_NAME}={}){
  return platform==='win32'&&host.toUpperCase()==='DESKTOP-N62L0NG'&&user.toLowerCase()==='ansqh'&&runner==='ansqh-tistory-publisher';
}
export async function verifyFile({id,file,expected}, {stat=noLink,stream=p=>fs.createReadStream(p)}={}){
  try{
    const s=stat(file);
    if(!s.isFile())return {id,status:'NOT_FILE'};
    const hash=crypto.createHash('sha256');let bytes=0;
    for await(const b of stream(file)){bytes+=b.length;hash.update(b);}
    const sha256=hash.digest('hex');
    return {id,status:sha256===expected?'MATCHED':'MISMATCH',bytes,sha256};
  }catch(e){return {id,status:'UNVERIFIED',code:errorCode(e)};}
}
function isLog(n){return typeof n==='string'&&/^[A-Za-z0-9_.-]{1,96}\.log$/i.test(n)&&(/\.dism\.log$/i.test(n)||/^(?:DISM|MOUNT|UNMOUNT|COMMIT|IMAGE|WIM)[\w.-]*\.log$/i.test(n));}
export async function verifyLog({id,file}, {stat=noLink,stream=p=>fs.createReadStream(p)}={}){
  try{
    const s=stat(file);
    if(!s.isFile()||s.size>64*1024*1024)return {id,status:'UNVERIFIED',code:'FILE_INVALID_OR_TOO_LARGE'};
    const hash=crypto.createHash('sha256');let bytes=0,lines=0,commit=0,error=0;
    const events=[];let omittedEvents=0;
    let partial='';
    const onLine = ln=>{
      lines++;
      const codes=[];
      if(/\/Unmount-Image[^\r\n]*\/Commit|DismUnmountImageHandle[^\r\n]*commit/i.test(ln)){commit++;codes.push('COMMIT_REQUEST');}
      if(/\/Mount-Image|DismMountImage/i.test(ln))codes.push('MOUNT_REQUEST');
      if(/\b(?:error\s*[:#=]?\s*(?:0x[0-9a-f]+|[1-9][0-9]*)|failed\s+to|HRESULT\s*[:=]\s*0x[0-9a-f]+)\b/i.test(ln)){error++;codes.push('ERROR_MENTION');}
      if(/The operation completed successfully|successfully committed/i.test(ln))codes.push('OPERATION_SUCCESS');
      const matched=ln.match(/\b(?:HRESULT\s*[:=]\s*|error\s*[:#=]?\s*)(0x[0-9a-f]{1,8}|[1-9][0-9]{0,9})\b/i);
      for(const code of codes){
        if(events.length<64)events.push({line:lines,code,...(code==='ERROR_MENTION'&&matched?{errorCode:matched[1].toLowerCase()}: {})});
        else omittedEvents++;
      }
    };
    for await(const b of stream(file)){
      bytes+=b.length;if(bytes>64*1024*1024)return {id,status:'UNVERIFIED',code:'LOG_SIZE_LIMIT'};
      hash.update(b);
      partial+=b.toString('utf8');
      if(partial.length>1024*1024)return {id,status:'UNVERIFIED',code:'LINE_SIZE_LIMIT'};
      const chunks=partial.split(/\r?\n/);partial=chunks.pop()??'';
      for(const line of chunks)onLine(line);
    }
    if(partial)onLine(partial);
    return {id,status:'READABLE',bytes,sha256:hash.digest('hex'),lines,commitRequests:commit,errorMentions:error,events,omittedEvents};
  }catch(e){return {id,status:'UNVERIFIED',code:errorCode(e)};}
}
// Only fixed evidence metadata and whitelisted status markers; never publish raw contents.
export async function inspectFixedEvidence({id,file},{stat=noLink,stream=p=>fs.createReadStream(p)}={}){
  try {
    const st=stat(file);
    if(!st.isFile()||st.size>16*1024*1024) return {id,status:'UNVERIFIED',code:'FILE_INVALID_OR_TOO_LARGE'};
    const h=crypto.createHash('sha256');let bytes=0;const chunks=[];
    for await(const chunk of stream(file)){
      bytes+=chunk.length;
      if(bytes>16*1024*1024)return {id,status:'UNVERIFIED',code:'EVIDENCE_SIZE_LIMIT'};
      h.update(chunk);chunks.push(chunk);
    }
    const raw=Buffer.concat(chunks).toString('utf8');
    let object=null;
    if(file.toLowerCase().endsWith('.json')) {
      try {object=JSON.parse(raw);}catch{}
    } else {
      object={};
      for(const m of raw.matchAll(/^(status|code|result|stage|rootCauseStage)\s*[:=]\s*([A-Z0-9_:-]{1,64})\s*$/gm))object[m[1]]=m[2];
    }
    const markers={};
    for(const key of ['status','code','result','stage','rootCauseStage']){
      const v=object?.[key];
      if(typeof v==='string'&&/^[A-Z0-9_:-]{1,64}$/.test(v))markers[key]=v;
    }
    return {id,status:'PRESENT',bytes,sha256:h.digest('hex'),markers};
  }catch(e){
    const code=errorCode(e);
    return {id,status:code==='ENOENT'?'MISSING':'UNVERIFIED',...(code==='ENOENT'?{}:{code})};
  }
}
export async function collectFixedEvidence(io={}){
  const evidence=[];
  for(const [id,file] of EVIDENCE)evidence.push(await inspectFixedEvidence({id,file},io));
  return {schema:'C996_OWNER_FIXED_EVIDENCE_V1',
    status:evidence.every(x=>x.status==='PRESENT')?'EVIDENCE_METADATA_COLLECTED':'PARTIAL',
    rootCauseStage:'UNKNOWN',evidence,rawContentsIncluded:false,operationalWrites:0};
}
export async function collect({stat=noLink,readdir=p=>fs.readdirSync(p,{withFileTypes:true}),stream=p=>fs.createReadStream(p)}={}){
  const files=[];
  for(const [id,file,expected] of FILES) files.push(await verifyFile({id,file,expected},{stat,stream}));
  const logs=[],logErrors=[]; let logCount=0;
  for(const [dirId,dir] of LOGDIRS){
    try{
      if(!stat(dir).isDirectory())throw Object.assign(new Error('Not directory'),{code:'ENOTDIR'});
      const names=readdir(dir).filter(x=>x.isFile()&&isLog(x.name)).map(x=>x.name).sort();
      if(logCount+names.length>16){logErrors.push({id:dirId,code:'LOG_COUNT_LIMIT'});continue;}
      for(const name of names){logCount++;logs.push(await verifyLog({id:dirId+'_'+logs.length,file:path.win32.join(dir,name)},{stat,stream}));}
    }catch(e){if(errorCode(e)!=='ENOENT')logErrors.push({id:dirId,code:errorCode(e)});}
  }
  const inputVerified=files.every(x=>x.status==='MATCHED');
  const logsReadable=logs.length>0&&logs.every(x=>x.status==='READABLE')&&logErrors.length===0;
  const commitObserved=logs.some(x=>x.commitRequests>0);
  return {schema:'C996_OWNER_FIXED_READONLY_V1',status:inputVerified&&logsReadable&&commitObserved?'COLLECTED_STAGE_UNPROVEN':'PARTIAL',rootCauseStage:'UNKNOWN',inputVerified,logScanComplete:logsReadable,commitObserved,files,logs,logErrors,rawLogIncluded:false,operationalWrites:0};
}
export function identifyRequest(event,env){
  const o=JSON.parse(event?.issue?.body??'null');
  if(event?.action!=='opened'||!Number.isSafeInteger(event?.issue?.number)||event.issue.number<=0||
    event.issue.title!=='c996-owner-fixed-readonly'||
    event.issue.user?.login!=='ansqhd5774-Choi'||event.repository?.full_name!=='ansqhd5774-Choi/nhunnhun_blog'||
    o?.schema!=='C996_OWNER_FIXED_READONLY_REQUEST_V1'||o?.operation!=='c996-owner-fixed-readonly'||
    !['operation,requestId,schema','mode,operation,requestId,schema'].includes(Object.keys(o).sort().join(','))||
    (o.mode!==undefined&&o.mode!=='fixed-evidence-only')||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(o.requestId)||
    !/^[1-9][0-9]{0,17}$/.test(env.GITHUB_RUN_ID??'')||env.GITHUB_RUN_ATTEMPT!=='1')
    throw new Error('C996_REQUEST_SCOPE_DENIED');
  return {requestId:o.requestId,issueNumber:event.issue.number,runId:env.GITHUB_RUN_ID,attempt:'1',mode:o.mode??'full'};
}
if(process.argv.includes('--run')){
  if(!authorizedOwnerContext())throw new Error('FIXED_OWNER_CONTEXT_DENIED');
  const ctx=identifyRequest(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),process.env);
  const result=ctx.mode==='fixed-evidence-only'?await collectFixedEvidence():await collect();
  console.log('C996_SANITIZED_RESULT='+JSON.stringify({...result,...ctx}));
  if(result.status==='PARTIAL')process.exitCode=2;
}
