import { chromium } from 'playwright-core';
import { localBrowserConfig } from '../publishing/local-browser.mjs';
const classify = error => ({name:String(error?.name??'Error'),code:String(error?.code??''),timeout:/timeout|timed out/i.test(String(error?.message??'')),refused:/ECONNREFUSED|refused/i.test(String(error?.message??'')),closed:/closed|disconnected|close/i.test(String(error?.message??'')),http:/unexpected status|400|401|403|404|500/i.test(String(error?.message??''))});
const url=process.env.TISTORY_CDP_URL || 'http://127.0.0.1:9223';
let ws;
try {
 const config=await localBrowserConfig();
 console.log('CDP_CONFIG_OK');
 const r=await fetch(url+'/json/version',{signal:AbortSignal.timeout(4000)});
 console.log('CDP_HTTP '+JSON.stringify({ok:r.ok,status:r.status}));
 if(!r.ok)process.exit(1);
 const body=await r.json();
 console.log('CDP_VERSION '+JSON.stringify({browser:String(body.Browser??'').slice(0,80),hasWs:!!body.webSocketDebuggerUrl}));
 ws=body.webSocketDebuggerUrl;
} catch(e){console.log('CDP_HTTP_FAILURE '+JSON.stringify(classify(e)));process.exit(1)}
if(ws){
 await new Promise(resolve=>{
   const socket=new WebSocket(ws);let done=false;
   const timeout=setTimeout(()=>finish('TIMEOUT'),7500);
   function finish(state){if(done)return;done=true;clearTimeout(timeout);console.log('CDP_RAW_WS '+state);try{socket.close()}catch{};resolve();}
   socket.addEventListener('open',()=>finish('OPEN'),{once:true});
   socket.addEventListener('error',()=>finish('ERROR'),{once:true});
   socket.addEventListener('close',()=>finish('CLOSED'),{once:true});
 });
}
for(const [kind,endpoint] of [['HTTP',url],['WS',ws]].filter(x=>x[1])){
 let browser;try {
   browser=await chromium.connectOverCDP(endpoint,{timeout:10000,isLocal:true,noDefaults:true});
   console.log('CDP_PLAYWRIGHT '+JSON.stringify({kind,status:'OK',contextCount:browser.contexts().length}));
 } catch(error){console.log('CDP_PLAYWRIGHT '+JSON.stringify({kind,status:'FAIL',...classify(error)}));}
 finally {if(browser){try{await browser.close()}catch(e){console.log('CDP_CLOSE '+JSON.stringify(classify(e)))}}}
}
