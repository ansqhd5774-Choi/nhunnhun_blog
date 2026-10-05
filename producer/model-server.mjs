import {spawn} from 'node:child_process';
import {mkdir,open,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {MODEL_DIGEST} from './draft.mjs';
async function confirmModel(){
  const tags=await(await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(5000)})).json();
  if(!tags.models?.some(m=>m.name==='qwen3.5:4b'&&m.digest===MODEL_DIGEST))throw new Error('E_MODEL_DIGEST');
}
export async function ensureModelServer(runtime){
  try{const r=await fetch('http://127.0.0.1:11434/api/version',{signal:AbortSignal.timeout(2000)});if(r.ok){const v=await r.json();if(v.version!=='0.35.1')throw new Error('E_OLLAMA_VERSION');await confirmModel();return;}}catch(e){if(['E_OLLAMA_VERSION','E_MODEL_DIGEST'].includes(e.message))throw e;}
  const exe=resolve(runtime,'..','tools','ollama','ollama.exe');await access(exe);
  await mkdir(join(runtime,'logs'),{recursive:true});await mkdir(join(runtime,'models'),{recursive:true});
  const log=await open(join(runtime,'logs','ollama-server.log'),'a',0o600);
  const child=spawn(exe,['serve'],{detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,OLLAMA_NO_CLOUD:'1',OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_MODELS:join(runtime,'models')}});
  await new Promise((r,j)=>{child.once('spawn',r);child.once('error',j);});child.unref();await log.close();
  let ready=false;
  for(let n=0;n<30;n++){try{const r=await fetch('http://127.0.0.1:11434/api/version',{signal:AbortSignal.timeout(1000)});if(r.ok){if((await r.json()).version!=='0.35.1')throw new Error('E_OLLAMA_VERSION');ready=true;break;}}catch(error){if(error.message==='E_OLLAMA_VERSION')throw error;}await delay(500);}
  if(!ready)throw new Error('E_OLLAMA_START_TIMEOUT');await confirmModel();
  console.log('전용 로컬 모델 서버를 시작했습니다.');
}
