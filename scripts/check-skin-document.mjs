import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Parser} from 'htmlparser2';
export function inspectSkinDocument(html){
  const counts={html:0,head:0,body:0};
  const parser=new Parser({onopentag(name){if(Object.hasOwn(counts,name))counts[name]++;}});
  parser.end(html);return counts;
}
export function assertSkinDocument(html){
  const counts=inspectSkinDocument(html);
  if(Object.values(counts).some(value=>value!==1))throw Error('E_SKIN_DOCUMENT_COUNT '+JSON.stringify(counts));
  return counts;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[2])throw Error('E_SKIN_PATH_REQUIRED');
  console.log(JSON.stringify(assertSkinDocument(await readFile(process.argv[2],'utf8'))));
}
