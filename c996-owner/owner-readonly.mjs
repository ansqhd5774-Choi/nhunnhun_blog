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
    let partial='';
    const onLine = ln=>{
      lines++;
      if(/\/Unmount-Image[^\r\n]*\/Commit|DismUnmountImageHandle[^\r\n]*commit/i.test(ln))commit++;
      if(/\b(?:error\s*[:#=]?\s*(?:0x[0-9a-f]+|[1-9][0-9]*)|failed\s+to|HRESULT\s*[:=]\s*0x[0-9a-f]+)\b/i.test(ln))error++;
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
    return {id,status:'READABLE',bytes,sha256:hash.digest('hex'),lines,commitRequests:commit,errorMentions:error};
  }catch(e){return {id,status:'UNVERIFIED',code:errorCode(e)};}
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
    }catch(e){logErrors.push({id:dirId,code:errorCode(e)});}
  }
  return {schema:'C996_OWNER_FIXED_READONLY_V1',status:files.every(x=>x.status==='MATCHED')&&logs.length>0&&logs.every(x=>x.status==='READABLE')&&logErrors.length===0?'COMPLETE':'PARTIAL',files,logs,logErrors,rawLogIncluded:false,operationalWrites:0};
}
if(process.argv.includes('--run')){
  if(!authorizedOwnerContext())throw new Error('FIXED_OWNER_CONTEXT_DENIED');
  console.log('C996_SANITIZED_RESULT='+JSON.stringify(await collect()));
}
