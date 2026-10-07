import { localRequest } from './ollama.mjs';

export async function ollamaJson(messages,format,{model,fetcher=fetch,numPredict=6000,numCtx=16384}={}){
  let lastProgress=Date.now();
  const result=await localRequest({
    model,stream:true,think:false,format,messages,keep_alive:'5m',
    options:{temperature:0.05,num_ctx:numCtx,num_predict:numPredict}
  },fetcher,async progress=>{
    if(Date.now()-lastProgress>=30000){console.log('QUEUE_MODEL_PROGRESS '+JSON.stringify({model,chunks:progress.chunks,characters:progress.content.length,at:new Date().toISOString()}));lastProgress=Date.now();}
  });
  console.log('QUEUE_MODEL_COMPLETE '+JSON.stringify({model,promptTokens:result.prompt_eval_count,outputTokens:result.eval_count}));
  try{return JSON.parse(result.message.content);}
  catch{throw new Error('E_QUEUE_OLLAMA_JSON');}
}
