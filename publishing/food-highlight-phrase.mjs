import {parseDocument} from 'htmlparser2';

const MAX_CHARS=32;
const SENTENCE_END_PATTERN=/(?:습니다|합니다|됩니다|입니다|아닙니다|있습니다|없습니다|좋습니다|쉽습니다|어렵습니다|됩니다|해요|이에요|예요)$/u;
const TERMINAL_PUNCTUATION_PATTERN=/[.!?。]$/u;
const CORE_HEADING_PATTERNS=[
  /^소개$/u,
  /^영양소·핵심\s*성분$/u,
  /^꾸준\s*섭취\s*변화$/u,
  /^궁합·시너지$/u,
  /^주의사항$/u,
  /^고르는\s*법·보관법$/u,
];
const DEFINITION_SIGNAL_PATTERN=/(?:식품|음식|재료|원물|과일|채소|곡물|콩류|두류|견과|씨앗|버섯|해산물|생선|어패류|육류|향신료|발효|가공|만든|굳힌|얻은|종류|통칭|이름|열매|뿌리|줄기|잎)/u;
const SEASON_SIGNAL_PATTERN=/(?:제철|수확|어획|유통|연중|사계절|봄|여름|가을|겨울|\d{1,2}\s*~\s*\d{1,2}월|\d{1,2}월)/u;
const NUTRITION_SIGNAL_PATTERN=/(?:kcal|열량|탄수화물|단백질|지방|식이섬유|당류|나트륨|칼슘|철분?|칼륨|비타민|미네랄|오메가|베타카로틴|폴리페놀|이소플라본)/iu;
const CHANGE_SIGNAL_PATTERN=/(?:감소|증가|개선|유지|보완|도움|관리|회복|포만감|배변|콜레스테롤|혈압|혈당|근육|뼈|면역|심혈관|장\s*건강)/u;
const CAUTION_SIGNAL_PATTERN=/(?:주의|피하|제한|조절|확인|중단|의료|알레르기|나트륨|약물?|복용|과다|금기|응급)/u;
const SELECT_SIGNAL_PATTERN=/(?:고르|선택|신선|껍질|색|무게|단단|포장|원재료|영양표|꼭지|향|탄력)/u;
const STORAGE_SIGNAL_PATTERN=/(?:보관|냉장|냉동|밀폐|실온|서늘|개봉|소비기한|유통기한|해동)/u;
const SUBSTANTIVE_BLOCK_MIN_CHARS=55;
// Limitation/no-effect highlights are already owned by direct-emphasis.mjs and must keep that
// more specific diagnostic instead of also producing the generic food narrative error.
const EXISTING_LIMITATION_PATTERN=/(?:근거|자료|증거)(?:가|는|를|도)?\s*(?:부족|충분하지|제한적)|(?:확인|입증|검증)(?:하지\s*못|되지\s*않)|단정(?:하기|할\s*수)?\s*어렵|(?:효과|변화|이득|개선)(?:가|은|는|을|를)?[^.!?]{0,30}(?:나타나지\s*않|없었|없습니다|확인하지\s*못|관찰되지\s*않)/u;
const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const cleanText=value=>String(value??'').replace(/\s+/gu,' ').trim();
const stripHeadingNumber=value=>cleanText(value).replace(/^\d+[.)]\s*/u,'');
const containsMark=node=>node?.name==='mark'||(node?.children??[]).some(containsMark);

function collectMarkTextsFromNode(node,texts=[]){
  if(node?.name==='mark'){
    const text=cleanText(nodeText(node));
    if(text)texts.push(text);
  }
  for(const child of node?.children??[])collectMarkTextsFromNode(child,texts);
  return texts;
}

function collectMarkTexts(html){
  return collectMarkTextsFromNode(parseDocument(html??''));
}

function collectCoreSections(html){
  const document=parseDocument(html??'');
  const sections=[];
  let current=null;
  for(const node of document.children??[]){
    if(node?.name==='h2'){
      const heading=stripHeadingNumber(nodeText(node));
      const axis=CORE_HEADING_PATTERNS.findIndex(pattern=>pattern.test(heading));
      current=axis>=0?{axis,heading,nodes:[],marks:[]}:null;
      if(current)sections.push(current);
      continue;
    }
    if(current)current.nodes.push(node);
  }
  for(const section of sections){
    for(const node of section.nodes)collectMarkTextsFromNode(node,section.marks);
  }
  return sections;
}

function collectSubstantiveBlocks(nodes,blocks=[]){
  for(const node of nodes??[]){
    if(['p','li'].includes(node?.name)){
      const text=cleanText(nodeText(node));
      if(Array.from(text).length>=SUBSTANTIVE_BLOCK_MIN_CHARS)blocks.push({node,text,hasMark:containsMark(node)});
    }
    collectSubstantiveBlocks(node?.children??[],blocks);
  }
  return blocks;
}

function foodAnchor(title){
  return cleanText(title).split(/[\s｜|·(（]/u)[0]??'';
}

function isNarrative(text){
  return Array.from(text).length>MAX_CHARS||SENTENCE_END_PATTERN.test(text)||TERMINAL_PUNCTUATION_PATTERN.test(text);
}

function hasAnchorDefinition(section,anchor){
  if(!section||!anchor)return false;
  const escaped=anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const anchorPattern=new RegExp(escaped,'u');
  const firstBlocks=collectSubstantiveBlocks(section.nodes).slice(0,2);
  const firstBlockMarks=firstBlocks.flatMap(block=>collectMarkTextsFromNode(block.node,[]));
  return firstBlockMarks.some(text=>anchorPattern.test(text)&&DEFINITION_SIGNAL_PATTERN.test(text));
}

function hasAxisCoverage(sections,anchor){
  if(sections.length!==6||sections.some((section,index)=>section.axis!==index))return true;
  const [intro,nutrition,changes,pairing,caution,storage]=sections;
  if(!hasAnchorDefinition(intro,anchor))throw Error('E_DIRECT_FOOD_HIGHLIGHT_DEFINITION_MISSING');
  if(!intro.marks.some(text=>SEASON_SIGNAL_PATTERN.test(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE');
  if(!nutrition.marks.some(text=>/\d/u.test(text)&&NUTRITION_SIGNAL_PATTERN.test(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE');
  if(!changes.marks.some(text=>CHANGE_SIGNAL_PATTERN.test(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE');
  if(!pairing.marks.length)throw Error('E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE');
  if(!caution.marks.some(text=>CAUTION_SIGNAL_PATTERN.test(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE');
  if(!storage.marks.some(text=>SELECT_SIGNAL_PATTERN.test(text))||!storage.marks.some(text=>STORAGE_SIGNAL_PATTERN.test(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_AXIS_COVERAGE');

  const uncovered=sections.flatMap(section=>collectSubstantiveBlocks(section.nodes).filter(block=>!block.hasMark));
  if(uncovered.length)throw Error('E_DIRECT_FOOD_HIGHLIGHT_BLOCK_COVERAGE');
}

export function assertFoodHighlightPhrases(source){
  if(source?.category!=='음식'||source?.contentStandard!=='SP1'||!source?.id?.startsWith('direct-'))return;
  const marks=collectMarkTexts(source.bodyHtml);
  if(!marks.length)return;
  if(marks.some(text=>!EXISTING_LIMITATION_PATTERN.test(text)&&isNarrative(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_NARRATIVE');

  const anchor=foodAnchor(source.title);
  if(anchor&&marks.length>=6){
    const escaped=anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const repeated=new RegExp(`^${escaped}(?:\\s|[·+→:-])`,'u');
    const repeatedCount=marks.filter(text=>repeated.test(text)).length;
    if(repeatedCount>=4&&repeatedCount>=Math.ceil(marks.length/2))throw Error('E_DIRECT_FOOD_HIGHLIGHT_SUBJECT_REPEAT');
  }

  // Full six-section food articles must be understandable by scanning only highlights.
  // This is coverage-driven, not a fixed global quota: more substantive blocks require more highlights.
  hasAxisCoverage(collectCoreSections(source.bodyHtml),anchor);
}
