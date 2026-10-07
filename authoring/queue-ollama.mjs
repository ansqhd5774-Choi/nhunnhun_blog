import { localRequest } from './ollama.mjs';

export function modelMetrics(result, { purpose, model, elapsedMs }) {
  const nsToMs = value => Number.isFinite(value) ? value / 1e6 : null;
  return { purpose, model, elapsedMs, promptTokens: result.prompt_eval_count ?? null,
    outputTokens: result.eval_count ?? null, loadMs: nsToMs(result.load_duration),
    promptMs: nsToMs(result.prompt_eval_duration), generationMs: nsToMs(result.eval_duration),
    totalMs: nsToMs(result.total_duration),
    tokensPerSecond: result.eval_duration > 0 && Number.isFinite(result.eval_count)
      ? result.eval_count / result.eval_duration * 1e9 : null };
}

export async function ollamaJson(messages,format,{model,fetcher=fetch,numPredict=6000,numCtx=16384,purpose='unspecified',onMetrics=()=>{}}={}){
  let lastProgress=Date.now();
  const started=Date.now();
  const result=await localRequest({
    model,stream:true,think:false,format,messages,keep_alive:'5m',
    options:{temperature:0.05,num_ctx:numCtx,num_predict:numPredict}
  },fetcher,async progress=>{
    if(Date.now()-lastProgress>=30000){console.log('QUEUE_MODEL_PROGRESS '+JSON.stringify({model,chunks:progress.chunks,characters:progress.content.length,at:new Date().toISOString()}));lastProgress=Date.now();}
  });
  const metrics=modelMetrics(result,{purpose,model,elapsedMs:Date.now()-started});
  onMetrics(metrics);
  console.log('QUEUE_MODEL_COMPLETE '+JSON.stringify(metrics));
  try{return JSON.parse(result.message.content);}
  catch{throw new Error('E_QUEUE_OLLAMA_JSON');}
}
