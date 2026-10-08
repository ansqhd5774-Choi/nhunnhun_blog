import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Local observation only: no gate, network request, rewrite or retry.
export function summarizeEmphasis(html) {
  const count=pattern=>(html.match(pattern)??[]).length;
  return {
    bold:count(/<(?:strong|b)\b[^>]*>/gi),
    highlight:count(/<mark\b[^>]*>/gi),
    underline:count(/<u\b[^>]*>/gi),
    level2:count(/<mark\b[^>]*>\s*<strong\b[^>]*>/gi),
    level3:count(/<mark\b[^>]*>\s*<u\b[^>]*>\s*<strong\b[^>]*>/gi)
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const source=JSON.parse(readFileSync(process.argv[2],'utf8'));
  console.log(JSON.stringify({sourceId:source.id,...summarizeEmphasis(source.bodyHtml??'')},null,2));
}
