import {readFile,readdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkUpdateSource} from '../publishing/update-core.mjs';
import {directPreflight} from '../publishing/direct-preflight.mjs';
import {removeFoodStockLead} from '../publishing/food-stock-lead-removal.mjs';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const UPDATES=resolve(ROOT,'updates');
const LEDGER=resolve(ROOT,'publishing/update-state');
const PATTERN=/핵심(?:만)?\s*먼저\s*:?/u;

async function json(path){
  return JSON.parse(await readFile(path,'utf8'));
}

// Use the latest independently verified revision per numeric article ID.
// Historical sources are immutable. Every correction gets a fresh direct ID.
async function latestVerifiedFood(){
  const result=new Map();
  for(const filename of await readdir(LEDGER)){
    if(!filename.endsWith('.json'))continue;
    const sourcePath=resolve(UPDATES,filename);
    if(!existsSync(sourcePath))continue;
    let ledger,source;
    try{[ledger,source]=await Promise.all([json(resolve(LEDGER,filename)),json(sourcePath)]);}
    catch{continue;}
    if(ledger.publicResult?.status!=='PUBLIC_VERIFIED'||ledger.phase!=='updated')continue;
    if(source.category!=='음식'||!source.id?.startsWith('direct-'))continue;
    if(String(ledger.articleId)!==String(source.articleId))continue;
    const time=Date.parse(ledger.timestamp)||0;
    const earlier=result.get(String(source.articleId));
    if(!earlier||time>earlier.time)result.set(String(source.articleId),{time,source,filename});
  }
  return result;
}

export async function makePlan(){
  const newest=await latestVerifiedFood();
  const targeted=[...newest].filter(([,entry])=>PATTERN.test(entry.source.bodyHtml??''));
  const passing=[],blocked=[];
  for(const [articleId,entry] of targeted){
    const {source}=entry;
    const id=`direct-${articleId}-summary-cleanup-20261022`;
    try{
      let updated={
        ...source,
        id,
        expectedCurrentTitle:source.title,
        changeScope:'content-update',
        bodyHtml:removeFoodStockLead(source.bodyHtml)
      };
      delete updated.preserveStructure;
      delete updated.structureBaseline;
      checkUpdateSource(updated,`${id}.json`);
      let result=directPreflight(updated);
      if(result.status!=='PREFLIGHT_PASS'){
        // Existing content may fail newly introduced, unrelated quality rules.
        // Permit only the exact, source-backed stock-lead removal in that case.
        updated={...updated,changeScope:'stock-lead-removal',stockLeadBaselineId:source.id};
        checkUpdateSource(updated,`${id}.json`);
        result=directPreflight(updated);
      }
      if(result.status!=='PREFLIGHT_PASS')throw Error(result.errors.join(','));
      passing.push({articleId,id,source:updated,prior:entry.filename});
    }catch(error){
      blocked.push({articleId,prior:entry.filename,reason:String(error.message)});
    }
  }
  return {totalVerifiedFood:newest.size,targeted:targeted.length,passing,blocked};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const plan=await makePlan();
  const write=process.argv.includes('--write');
  for(const item of plan.passing){
    if(!write)continue;
    const file=resolve(UPDATES,`${item.id}.json`);
    const value=JSON.stringify(item.source,null,2)+'\n';
    if(existsSync(file)){
      if(await readFile(file,'utf8')!==value)throw Error(`E_ALREADY_EXISTS:${item.id}`);
      continue;
    }
    await writeFile(file,value,'utf8');
  }
  console.log(JSON.stringify({
    latestVerified:plan.totalVerifiedFood,
    stockLeadTargets:plan.targeted,
    prepared:plan.passing.length,
    scoped:plan.passing.filter(item=>item.source.changeScope==='stock-lead-removal').length,
    blocked:plan.blocked,
    ids:plan.passing.map(item=>item.id),
    written:write
  },null,2));
}
