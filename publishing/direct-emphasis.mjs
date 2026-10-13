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

const OFFICIAL_INTAKE_ABSENCE_PATTERN=/(?:공식\s*)?(?:하루\s*)?(?:권장량|권장\s*섭취량|상한)(?:이|가|은|는)?[^.!?]{0,35}(?:없|정해(?:지지|져\s*있지)\s*않|마련되지\s*않)/u;
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
  OFFICIAL_INTAKE_ABSENCE_PATTERN,
  /(?:유의하게|뚜렷하게)[^.!?]{0,35}(?:달라지지\s*않|변하지\s*않|개선되지\s*않)/u,
  /(?:같은|동일한)\s*(?:효과\s*크기|섭취\s*기준|용량|조건)[^.!?]{0,30}(?:(?:계산|판단|적용)하지\s*않|아니|않|다(?:르|릅))/u,
  /(?:보충|농축|추출|오일)[^.!?]{0,70}(?:조리용|일상|평소)[^.!?]{0,45}(?:조건|용량|농도|제형)(?:이|가|은|는)?\s*다(?:르|릅)/u,
  /(?:조리용|일상|평소)[^.!?]{0,70}(?:보충|농축|추출|오일)[^.!?]{0,45}(?:조건|용량|농도|제형)(?:이|가|은|는)?\s*다(?:르|릅)/u,
  /(?:연구|시험|자료|수치|용량)[^.!?]{0,70}(?:권장량|안전\s*상한)[^.!?]{0,30}(?:바꾸지\s*않|간주하지\s*않)/u,
  /(?:일상|평소|조리용)[^.!?]{0,45}(?:그대로|같은)[^.!?]{0,25}(?:적용|계산|판단)(?:하지\s*않|할\s*수\s*없)/u,
  /(?:효과|개선|수치|결과)[^.!?]{0,55}(?:예방|치료|효능)[^.!?]{0,35}(?:바꾸어\s*해석하면\s*안|확대(?:해|하여)\s*표현하지\s*않|동일하게\s*볼\s*수\s*없)/u,
];
const PURE_SAFETY_HEADING=/^(?:주의(?:사항)?|부작용(?:과|·)\s*주의(?:사항)?|금기(?:와|·)\s*주의(?:사항)?|응급(?:\s*신호)?|이상반응(?:과|·)\s*주의(?:사항)?)$/u;
const ACTIONABLE_SAFETY_PATTERN=/(?:즉시\s*(?:중단|진료|병원|응급)|복용을?\s*중단|섭취를?\s*중단|피해야|복용하지\s*말|섭취하지\s*말|의료진(?:과|에게)\s*(?:상담|확인)|진료를?\s*받)/u;
const BENEFIT_HEADING_PATTERN=/(?:효능|효과|기대\s*변화|건강상\s*이점|장점)/u;
const BENEFIT_OUTCOME_PATTERN=/(?:개선|증가|감소|낮추|줄이|유지|보호|회복|완화|향상|도움|위험\s*감소|진행\s*(?:지연|감소))/u;
const MARK_TONES=new Set(['positive','info','caution','negative']);
const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const cleanText=value=>String(value??'').replace(/\s+/gu,' ').trim();

// New submission preparation only. Historical read-only loading keeps its existing guard.
export function assertDirectSubmissionEmphasis(source) {
  if(source.contentStandard!=='SP1'||!source.id?.startsWith('direct-'))return;
  assertDirectEmphasis(source);
  const minimums=source.category==='음식'?DIRECT_FOOD_EMPHASIS_MINIMUMS:DIRECT_EMPHASIS_MINIMUMS;
  let currentHeading='';
  let inBenefitSection=false;
  let hasBenefitSection=false;
  let benefitOutcomeHighlights=0;
  let primaryHighlights=0;
  let boldCount=0;
  let highlightCount=0;
  let underlineCount=0;
  const visit=node=>{
    if(node.name==='h2'){
      currentHeading=cleanText(nodeText(node)).replace(/^\d+[.)]\s*/u,'');
      inBenefitSection=BENEFIT_HEADING_PATTERN.test(currentHeading);
      if(inBenefitSection)hasBenefitSection=true;
    }
    if(node.name==='strong')boldCount++;
    if(node.name==='mark') {
      highlightCount++;
      const rawTone=node.attribs?.['data-tone'];
      const tone=rawTone==null?'default':String(rawTone).trim().toLowerCase();
      if(tone!=='default'&&!MARK_TONES.has(tone))throw Error('E_DIRECT_EMPHASIS_TONE');
      const children=(node.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim()));
      const inner=children[0];
      const underlined=inner?.name==='u';
      const boldChildren=underlined?(inner.children??[]).filter(n=>n.type!=='comment' && !(n.type==='text'&&!n.data.trim())):children;
      if(children.length!==1||boldChildren.length!==1||boldChildren[0].name!=='strong')throw Error('E_DIRECT_EMPHASIS_STRUCTURE');
      if(underlined)underlineCount++;
      const text=cleanText(nodeText(node));
      const isLimitation=LIMITATION_HIGHLIGHT_PATTERNS.some(pattern=>pattern.test(text));
      const isActionableSafety=PURE_SAFETY_HEADING.test(currentHeading)&&ACTIONABLE_SAFETY_PATTERN.test(text);
      // Evidence limits, no-effect statements and neutral absence-of-standard facts stay plain/bold.
      // Only an actionable safety instruction in a dedicated safety section may remain strongly highlighted.
      if(isLimitation&&!isActionableSafety)throw Error('E_DIRECT_EMPHASIS_LIMITATION');
      if(!PURE_SAFETY_HEADING.test(currentHeading))primaryHighlights++;
      if(source.category==='영양소'&&inBenefitSection&&tone==='positive'&&BENEFIT_OUTCOME_PATTERN.test(text))benefitOutcomeHighlights++;
    }
    for(const child of node.children??[])visit(child);
  };
  visit(parseDocument(source.bodyHtml??''));
  if(!primaryHighlights)throw Error('E_DIRECT_PRIMARY_EMPHASIS_MISSING');
  // Nutrient benefit sections must visibly emphasize at least one confirmed health outcome,
  // not merely evidence quality, limitations, dosage, or product-selection facts.
  if(source.category==='영양소'&&hasBenefitSection&&!benefitOutcomeHighlights)throw Error('E_DIRECT_BENEFIT_EMPHASIS_MISSING');
  if(boldCount<minimums.bold)throw Error('E_DIRECT_EMPHASIS_BOLD_MIN');
  if(highlightCount<minimums.highlight)throw Error('E_DIRECT_EMPHASIS_HIGHLIGHT_MIN');
  if(underlineCount<minimums.underline)throw Error('E_DIRECT_EMPHASIS_UNDERLINE_MIN');
  return {boldCount,highlightCount,underlineCount};
}
