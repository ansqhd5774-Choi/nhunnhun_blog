import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument } from 'htmlparser2';
import {writeAndReview} from './producer-model.mjs';

export function currentTitle(html) {
  const doc=parseDocument(html);
  const find=node=>[...(node.name==='h1'?[node]:[]),...(node.children??[]).flatMap(find)];
  const text=node=>node.type==='text'?node.data:(node.children??[]).map(text).join('');
  const titles=find(doc).map(text).map(s=>s.trim()).filter(Boolean);
  if(titles.length!==1 || titles[0].length>150) throw new Error('E_QUEUE_PUBLIC_TITLE');
  return titles[0];
}
export async function produceUpdate(item,{root=process.cwd(),fetcher=fetch}={}) {
  const target=resolve(root,'automation/update-queue-results',item.id,process.env.GITHUB_RUN_ID??`local-${Date.now()}`);
  await mkdir(target,{recursive:true});
  const response=await fetcher(item.url,{redirect:'error',signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error('E_QUEUE_PUBLIC_TARGET');
  const expectedCurrentTitle=currentTitle(await response.text());
  await writeFile(resolve(target,'target.json'),JSON.stringify({url:item.url,expectedCurrentTitle,checkedAt:new Date().toISOString()},null,2)+'\n');
  return writeAndReview(item,expectedCurrentTitle,{root,target,fetcher});
}
