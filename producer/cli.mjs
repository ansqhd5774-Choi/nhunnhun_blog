import { Queue } from './queue.mjs';
import { resolve,join } from 'node:path';
import { mkdir,readFile,open,access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import {ensureModelServer} from './model-server.mjs';
import {artifactPath} from './artifacts.mjs';
import {FOOD_CATALOG} from './discovery.mjs';
import {assertSupportedKeyword} from './keyword.mjs';
import {resumeValidationCheckpoint} from './resume-checkpoint.mjs';
const runtime=resolve(process.env.NH_RUNTIME??join(fileURLToPath(new URL('../../../outputs/',import.meta.url)),'runtime'));
await mkdir(runtime,{recursive:true});
const queue=new Queue(join(runtime,'queue.db'));
async function workerControl(action){
  const control=JSON.parse(await readFile(join(runtime,'worker-control.json'),'utf8'));
  if(!Number.isInteger(control.port)||control.port<1024||control.port>65535||!/^[a-f0-9-]{36}$/.test(control.token??''))throw new Error('E_WORKER_CONTROL');
  const r=await fetch(`http://127.0.0.1:${control.port}/${action}`,{method:action==='stop'?'POST':'GET',headers:{Authorization:`Bearer ${control.token}`},signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw new Error('E_WORKER_UNREACHABLE');return action==='status'?r.json():{status:'STOPPING'};
}
async function start(){
  try{await workerControl('status');console.log('이미 실행 중입니다.');return;}catch{}
  await ensureModelServer(runtime);
  await mkdir(join(runtime,'logs'),{recursive:true});const log=await open(join(runtime,'logs','producer.log'),'a',0o600);
  const child=spawn(process.execPath,[fileURLToPath(new URL('./worker.mjs',import.meta.url)),runtime],{detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
  await new Promise((r,j)=>{child.once('spawn',r);child.once('error',j);});child.unref();await log.close();
  console.log('자료 수집·로컬 모델 작성·미리보기 검증 작업자를 시작했습니다. 공개 연결은 구축 중입니다.');
}
function list(){
  const jobs=queue.list();if(!jobs.length){console.log('등록된 작업이 없습니다.');return;}
  for(const job of jobs)console.log(`${job.job_id} | ${job.task_type} | ${job.state} | ${job.topic}${job.metadata.public_url?' | '+job.metadata.public_url:''}${job.last_error_code?' | '+job.last_error_code:''} | 마지막 PASS: ${job.last_pass_stage??'없음'} | 최초 FAIL: ${job.first_fail_stage??'없음'}`);
}
async function review(id){
  const path=artifactPath(runtime,id,'preview.html');await access(path);
  const child=spawn(join(process.env.SYSTEMROOT??'C:\\Windows','System32','rundll32.exe'),['url.dll,FileProtocolHandler',path],{windowsHide:true,detached:true,stdio:'ignore'});
  await new Promise((r,j)=>{child.once('spawn',r);child.once('error',j);});child.unref();console.log('로컬 초안 미리보기를 열었습니다. 공개 발행 결과가 아닙니다.');
}
async function menu(){
  const io=createInterface({input:stdin,output:stdout});
  try{
    console.log('NHUNNHUN 로컬 생산기 구축판 · DRAFT_ONLY · 실제 공개 비활성');
    console.log('키워드로 자료를 찾아 초안과 미리보기를 만듭니다. 자료 부족·기존 글 중복은 보류합니다. 자동 발행은 아직 시험 중입니다.');
    console.log('자동 조사 키워드: '+Object.keys(FOOD_CATALOG).join(', '));
    while(true){
      console.log('\n1 작업 목록  2 키워드 입력  3 기존 URL 최신화 요청 등록  4 고급 자료 JSON  5 작성 시작  6 정지  7 보류 재개  8 백업  9 초안 보기  0 종료');
      const choice=(await io.question('선택: ')).trim();if(choice==='0')break;
      try{
        if(choice==='1')list();
        else if(choice==='2'){const topic=await assertSupportedKeyword(await io.question('키워드: '),runtime);const result=queue.enqueue({task_type:'NEW',topic});console.log(`${result.duplicate?'기존 작업':'등록 완료'}: ${result.job.job_id}`);await start();}
        else if(choice==='3'){const url=(await io.question('기존 숫자 URL: ')).trim(),match=url.match(/^https:\/\/nhunnhun\.tistory\.com\/(\d+)$/);if(!match)throw new Error('E_UPDATE_TARGET');const expected_title=await io.question('현재 공개 제목: '),topic=await io.question('최신화 요청: '),revision=await io.question('요청 revision (예: r1): ');const result=queue.enqueue({task_type:'UPDATE',topic,article_id:match[1],target_url:url,expected_title,revision});console.log(`요청 등록: ${result.job.job_id} · 기존 글 수정 완료가 아닙니다.`);}
        else if(choice==='4'){const path=(await io.question('작업 요청 JSON 파일 경로: ')).trim();const request=JSON.parse(await readFile(path,'utf8'));const result=queue.enqueue(request);console.log(`등록: ${result.job.job_id}`);}
        else if(choice==='5')await start();
        else if(choice==='6'){await workerControl('stop');console.log('정지 요청 완료. 안전 checkpoint 후 종료합니다.');}
        else if(choice==='7'){const id=(await io.question('작업 ID: ')).trim(),job=queue.get(id);const resumable=job?.state==='RETRY_WAIT'&&['E_REVIEW_INCOMPLETE','E_REVIEW_HTTP','E_REVIEW_SCHEMA','E_LOCAL_PREVIEW'].includes(job.last_error_code);const result=resumable?await resumeValidationCheckpoint(queue,runtime,id):queue.resume(id);console.log(result.state);await start();}
        else if(choice==='8'){const target=join(runtime,'backup',`queue-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);queue.backup(target);console.log('일관된 Queue snapshot을 저장했습니다. 복구 후에는 Git/공개/ledger 대조가 필요합니다.');}
        else if(choice==='9')await review((await io.question('미리볼 작업 ID: ')).trim());
      }catch(error){console.log(/^[A-Z_]+$/.test(error?.message??'')?error.message:'작업 입력 또는 연결을 확인하세요.');}
    }
  }finally{io.close();}
}
try{
  const command=process.argv[2]??'menu';
  if(command==='menu')await menu();else if(command==='status'){list();try{console.log((await workerControl('status')).status);}catch{console.log('STOPPED');}}
  else if(command==='start')await start();else if(command==='stop'){await workerControl('stop');console.log('STOPPING');}
  else if(command==='add-json'){const input=JSON.parse(await readFile(process.argv[3],'utf8'));console.log(queue.enqueue(input).job.job_id);}
  else if(command==='review'){let id=process.argv[3];if(!id){list();const io=createInterface({input:stdin,output:stdout});try{id=(await io.question('미리볼 작업 ID: ')).trim();}finally{io.close();}}await review(id);}
  else throw new Error('E_COMMAND');
}catch(error){console.error(/^[A-Z_]+$/.test(error?.message??'')?error.message:'E_CLI_RUNTIME');process.exitCode=1;}finally{queue.close();}
