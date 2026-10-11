import {parseDocument} from 'htmlparser2';

export const DIRECT_EMPHASIS_MINIMUMS=Object.freeze({
  bold:18,
  highlight:8,
  underline:2,
});

// Structural omission guard only; the author still chooses meaningful phrases.
export function assertDirectEmphasis(source) {
  if(!source.id?.startsWith('direct-'))return;
  const contains=(node,name)=>(node.children??[]).some(child=>child.name===name||contains(child,name));
  let emphasized=false;
  const visit=node=>{
    if(node.name==='mark'&&contains(node,'strong'))emphasized=true;
    for(const child of node.children??[])visit(child);
  };
  visit(parseDocument(source.bodyHtml??''));
  if(!emphasized)throw Error('E_DIRECT_EMPHASIS_MISSING');
}

const LIMITATION_HIGHLIGHT_PATTERNS=[
  /(?:근거|자료|연구|증거)(?:가|는|를)?\s*(?:부족|충분하지|제한적)/u,
  /(?:확인|입증|검증)(?:되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)/u,
  /단정(?:하기|할\s*수)?\s*어렵/u,
  /말할\s*만한[^.!?]{0,30}근거(?:가|는)?\s*부족/u,
];
const SAFETY_HEADING=/(?:주의|부작용|금기|위험|응급|이상반응)/u;
const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const cleanText=value=>String(value??'').replace(/\s+/gu,' ').trim();

// New submission preparation only. Historical read-only loading keeps its existing guard.
export function assertDirectSubmissionEmphasis(source) {
  if(source.contentStandard!=='SP1'||!source.id?.startsWith('direct-'))return;
  assertDirectEmphasis(source);
  let currentHeading='';
  let primaryHighlights=0;
  let boldCount=0;
  let highlightCount=0;
  let underlineCount=0;
  const visit=node=>{
    if(node.name==='h2')currentHeading=cleanText(nodeText(node));
    if(node.name==='strong')boldCount++;
    if(node.name==='mark') {
      highlightCount++;
      const children=(node.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim()));
      const inner=children[0];
      const underlined=inner?.name==='u';
      const boldChildren=underlined?(inner.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim())):children;
      if(children.length!==1||boldChildren.length!==1||boldChildren[0].name!=='strong')throw Error('E_DIRECT_EMPHASIS_STRUCTURE');
      if(underlined)underlineCount++;
      const text=cleanText(nodeText(node));
      if(LIMITATION_HIGHLIGHT_PATTERNS.some(pattern=>pattern.test(text)))throw Error('E_DIRECT_EMPHASIS_LIMITATION');
      if(!SAFETY_HEADING.test(currentHeading))primaryHighlights++;
    }
    for(const child of node.children??[])visit(child);
  };
  visit(parseDocument(source.bodyHtml??''));
  if(!primaryHighlights)throw Error('E_DIRECT_PRIMARY_EMPHASIS_MISSING');
  if(boldCount<DIRECT_EMPHASIS_MINIMUMS.bold)throw Error('E_DIRECT_EMPHASIS_BOLD_MIN');
  if(highlightCount<DIRECT_EMPHASIS_MINIMUMS.highlight)throw Error('E_DIRECT_EMPHASIS_HIGHLIGHT_MIN');
  if(underlineCount<DIRECT_EMPHASIS_MINIMUMS.underline)throw Error('E_DIRECT_EMPHASIS_UNDERLINE_MIN');
  return {boldCount,highlightCount,underlineCount};
}
