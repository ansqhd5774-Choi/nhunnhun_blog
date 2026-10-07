import { localRequest } from './ollama.mjs';

export async function ollamaJson(messages,format,{model,fetcher=fetch,numPredict=6000,numCtx=16384}={}){
  const result=await localRequest({
    model,stream:true,think:false,format,messages,keep_alive:'5m',
    options:{temperature:0.05,num_ctx:numCtx,num_predict:numPredict}
  },fetcher);
  try{return JSON.parse(result.message.content);}
  catch{throw new Error('E_QUEUE_OLLAMA_JSON');}
}
