// One-time transition helper. Each installed listener runs its own repository code.
// Never copy the existing runner credentials, env file, .runner file, or work tree.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawn} from 'node:child_process';

async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32'||
    process.env.INDEPENDENT_WRITER_HOST!==os.hostname()||process.env.RUNNER_NAME!=='ansqh-tistory-publisher')throw Error('E_INDEPENDENT_HOST');
 const source=path.dirname(path.dirname(process.env.RUNNER_WORKSPACE));
 for(const p of ['config.cmd','run.cmd','bin/Runner.Listener.exe','externals'])if(!fs.existsSync(path.join(source,p)))throw Error('E_INDEPENDENT_RUNNER_SOURCE');
 const home=path.join(process.env.LOCALAPPDATA,'NHUNNHUN','IndependentRunners');
 const startup=path.join(process.env.APPDATA,'Microsoft','Windows','Start Menu','Programs','Startup');
 if(!fs.existsSync(startup))throw Error('E_INDEPENDENT_STARTUP');
 const allowed=['PATH','PATHEXT','SYSTEMROOT','WINDIR','SYSTEMDRIVE','COMSPEC','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMDATA','USERNAME','USERDOMAIN','OS','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','PUBLIC'];
 const clean=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.includes(k.toUpperCase())));
 clean.RUNNER_TRACKING_ID='';
 const escape=s=>String(s).replaceAll('"','""');
 const result=[];
 for(const [key,repo] of [['disease','nhunnhun_disease'],['nutrients','nhunnhun_nutrients'],['pharmacology','nhunnhun_pharmacology']]){
   const token=process.env['INDEPENDENT_TOKEN_'+key.toUpperCase()];
   if(!/^[A-Za-z0-9_.-]{20,200}$/.test(token??''))throw Error('E_INDEPENDENT_REGISTRATION_TOKEN');
   const root=path.resolve(home,key),url='https://github.com/ansqhd5774-Choi/'+repo;
   const marker=path.join(root,'independent-runner.json'),runner=path.join(root,'.runner');
   if(!root.startsWith(path.resolve(home)+path.sep))throw Error('E_INDEPENDENT_PATH');
   if(fs.existsSync(root)&&!fs.existsSync(marker))throw Error('E_INDEPENDENT_EXISTING_DIRECTORY');
   if(fs.existsSync(marker)&&JSON.parse(fs.readFileSync(marker,'utf8')).repository!==repo)throw Error('E_INDEPENDENT_MARKER');
   fs.mkdirSync(root,{recursive:true});
   if(!fs.existsSync(marker))fs.writeFileSync(marker,JSON.stringify({repository:repo,host:os.hostname()}),{flag:'wx'});
   if(!fs.existsSync(runner)){
     for(const dir of ['bin','externals'])fs.cpSync(path.join(source,dir),path.join(root,dir),{recursive:true});
     for(const name of ['config.cmd','run.cmd','run-helper.cmd.template','env.cmd'])if(fs.existsSync(path.join(source,name)))fs.copyFileSync(path.join(source,name),path.join(root,name));
     const args=['configure','--unattended','--url',url,'--token',token,'--name',os.hostname()+'-'+key,'--labels','tistory-'+key,'--work','_work'];
     // Do not print the command, error object, or config output: token is an argument.
     try{execFileSync(path.join(root,'bin','Runner.Listener.exe'),args,{cwd:root,env:clean,stdio:'pipe',windowsHide:true,timeout:120000});}
     catch(error){
       const text=String(error.stdout??'')+' '+String(error.stderr??'');
       const code=/access is denied|unauthorizedaccess/i.test(text)?'E_INDEPENDENT_CONFIG_ACCESS':
         /already configured/i.test(text)?'E_INDEPENDENT_CONFIG_ALREADY_EXISTS':
         /not found|404|401|403|bad credentials/i.test(text)?'E_INDEPENDENT_CONFIG_AUTH':
         /not recognized|cannot find|specified path|invalid argument/i.test(text)?'E_INDEPENDENT_CONFIG_EXECUTION':'E_INDEPENDENT_REGISTRATION_FAILED';
       throw Error(code);
     }
   }
   const config=JSON.parse(fs.readFileSync(runner,'utf8'));
   if(String(config.gitHubUrl??'').replace(/\/$/,'')!==url)throw Error('E_INDEPENDENT_REGISTERED_TARGET');
   const file=path.join(startup,'NHUNNHUN-Independent-'+key+'.vbs');
   const lines=['Set shell = CreateObject("WScript.Shell")',`shell.CurrentDirectory = "${escape(root)}"`,'shell.Environment("PROCESS")("RUNNER_TRACKING_ID") = ""'];
   for(const name of ['TISTORY_CHROME_PATH','TISTORY_PROFILE_DIR','TISTORY_CDP_URL'])if(process.env[name])lines.push(`shell.Environment("PROCESS")("${name}") = "${escape(process.env[name])}"`);
   lines.push(`shell.Run Chr(34) & "${escape(path.join(root,'run.cmd'))}" & Chr(34), 0, False`);
   const script=lines.join('\r\n')+'\r\n';
   // A managed existing startup file is never launched twice on retry.
   if(!fs.existsSync(file)){
     fs.writeFileSync(file,'\ufeff'+script,{encoding:'utf16le',flag:'wx'});
     const child=spawn(path.join(process.env.SystemRoot,'System32','wscript.exe'),['//B','//NoLogo',file],{cwd:root,env:clean,detached:true,stdio:'ignore',windowsHide:true});
     await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
     child.unref();
   }else if(fs.readFileSync(file,'utf16le')!=='\ufeff'+script)throw Error('E_INDEPENDENT_STARTUP_CONFLICT');
   result.push({repository:repo,configured:true,startup:'user-login-hidden',listenerStatus:'verify-github-api'});
 }
 console.log('INDEPENDENT_RUNNER_CONFIGURED '+JSON.stringify(result));
}
main().catch(error=>{console.error(/^E_[A-Z_]+$/.test(error?.message??'')?error.message:'E_INDEPENDENT_SETUP_STOPPED_REVIEW_STATE');process.exitCode=1;});
