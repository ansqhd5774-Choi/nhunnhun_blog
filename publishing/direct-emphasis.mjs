import {parseDocument} from 'htmlparser2';
import {DIRECT_AUTHORING_CONTRACT} from './direct-authoring-contract.mjs';

export const DIRECT_EMPHASIS_MINIMUMS=DIRECT_AUTHORING_CONTRACT.emphasisMinimums;
export const DIRECT_FOOD_EMPHASIS_MINIMUMS=DIRECT_AUTHORING_CONTRACT.foodEmphasisMinimums;

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
  /(?:근거|자료|연구|증거)(?:가|는|를|도)?\s*(?:부족|충분하지|제한적)/u,
  /(?:확인|입증|검증)(?:하지\s*못|되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)/u,
  /단정(?:하기|할\s*수)?\s*어렵/u,
  /말할\s*만한[^.!?]{0,30}근거(?:가|는)?\s*부족/u,
  /확립(?:(?:되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)|(?:(?:돼|되어)\s*있지\s*않))/u,
  /(?:보장|장담)(?:할\s*수)?\s*없/u,
  /(?:효과|변화|이득|개선)(?:가|은|는|을|를)?[^.!?]{0,30}(?:나타나지\s*않|없었|없습니다|확인하지\s*못|관찰되지\s*않)/u,
  /(?:(?:비교\s*가능한)\s*)?(?:공식\s*)?(?:자료|데이터(?:베이스)?|기준)(?:가|는)?\s*(?:없|마련되지\s*않)/u,
  /(?:모든|누구나)[^.!?]{0,40}(?:필요|먹어야|복용해야|섭취해야)[^.!?]{0,25}(?:아니|아닙|없)/u,
  /(?:공식\s*)?(?:하루\s*)?(?:권장량|권장\s*섭취량|상한)(?:이|가|은|는)?[^.!?]{0,35}(?:없|정해(?:지지|져\s*있지)\s*않|마련되지\s*않)/u,
  /(?:유의하게|뚜렷하게)[^.!?]{0,35}(?:달라지지\s*않|변하지\s*않|개선되지\s*않)/u,
  /(?:같은|동일한)\s*(?:효과\s*크기|섭취\s*기준|용량|조건)[^.!?]{0,30}(?:(?:계산|판단|적용)하지\s*않|아니|않|다(?:르|릅))/u,
  /(?:보충|농축|추출|오일)[^.!?]{0,70}(?:조리용|일상|평소)[^.!?]{0,45}(?:조건|용량|농도|제형)(?:이|가|은|는)?\s*다(?:르|릅)/u,
  /(?:조리용|일상|평소)[^.!?]{0,70}(?:보충|농축|추출|오일)[^.!?]{0,45}(?:조건|용량|농도|제형)(?:이|가|은|는)?\s*다(?:르|릅)/u,
  /(?:연구|시험|자료|수치|용량)[^.!?]{0,70}(?:권장량|안전\s*상한)[^.!?]{0,30}(?:바꾸지\s*않|간주하지\s*않)/u,
  /(?:일상|평소|조리용)[^.!?]{0,45}(?:그대로|같은)[^.!?]{0,25}(?:적용|계산|판단)(?:하지\s*않|할\s*수\s*없)/u,
];
const PURE_SAFETY_HEADING=/^(?:주의(?:사항)?|부작용(?:과|·)\s*주의(?:사항)?|금기(?:와|·)\s*주의(?:사항)?|응급(?:\s*신호)?|이상반응(?:과|·)\s*주의(?:사항)?)$/u;
const MARK_TONES=new Set(['key','action','info','caution','danger']);
const NEGATIVE_TONES=new Set(['caution','danger']);
const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const cleanText=value=>String(value??'').replace(/\s+/gu,' ').trim();

// New submission preparation only. Historical read-only loading keeps its existing guard.
export function assertDirectSubmissionEmphasis(source) {
  if(source.contentStandard!=='SP1'||!source.id?.startsWith('direct-'))return;
  assertDirectEmphasis(source);
  const minimums=source.category==='음식'?DIRECT_FOOD_EMPHASIS_MINIMUMS:DIRECT_EMPHASIS_MINIMUMS;
  let currentHeading='';
  let primaryHighlights=0;
  let boldCount=0;
  let highlightCount=0;
  let underlineCount=0;
  const visit=node=>{
    if(node.name==='h2')currentHeading=cleanText(nodeText(node)).replace(/^\d+[.)]\s*/u,'');
    if(node.name==='strong')boldCount++;
    if(node.name==='mark') {
      highlightCount++;
      const tone=String(node.attribs?.['data-tone']??'key').trim().toLowerCase();
      if(!MARK_TONES.has(tone))throw Error('E_DIRECT_EMPHASIS_TONE');
      const children=(node.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim()));
      const inner=children[0];
      const underlined=inner?.name==='u';
      const boldChildren=underlined?(inner.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim())):children;
      if(children.length!==1||boldChildren.length!==1||boldChildren[0].name!=='strong')throw Error('E_DIRECT_EMPHASIS_STRUCTURE');
      if(underlined)underlineCount++;
      const text=cleanText(nodeText(node));
      const isLimitation=LIMITATION_HIGHLIGHT_PATTERNS.some(pattern=>pattern.test(text));
      // Limitations may be highlighted only when the author explicitly marks them as caution/danger.
      // This keeps positive/key highlights from becoming warning-heavy while allowing meaningful negative colors.
      if(isLimitation&&!NEGATIVE_TONES.has(tone))throw Error('E_DIRECT_EMPHASIS_LIMITATION');
      if(!PURE_SAFETY_HEADING.test(currentHeading))primaryHighlights++;
    }
    for(const child of node.children??[])visit(child);
  };
  visit(parseDocument(source.bodyHtml??''));
  if(!primaryHighlights)throw Error('E_DIRECT_PRIMARY_EMPHASIS_MISSING');
  if(boldCount<minimums.bold)throw Error('E_DIRECT_EMPHASIS_BOLD_MIN');
  if(highlightCount<minimums.highlight)throw Error('E_DIRECT_EMPHASIS_HIGHLIGHT_MIN');
  if(underlineCount<minimums.underline)throw Error('E_DIRECT_EMPHASIS_UNDERLINE_MIN');
  return {boldCount,highlightCount,underlineCount};
}
