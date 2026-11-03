import {parseDocument} from 'htmlparser2';

const MAX_CHARS=32;
const SENTENCE_END_PATTERN=/(?:습니다|합니다|됩니다|입니다|아닙니다|있습니다|없습니다|좋습니다|쉽습니다|어렵습니다|됩니다|해요|이에요|예요)$/u;
const TERMINAL_PUNCTUATION_PATTERN=/[.!?。]$/u;
const EXISTING_LIMITATION_PATTERN=/(?:근거|자료|증거)(?:가|는|를|도)?\s*(?:부족|충분하지|제한적)|(?:확인|입증|검증)(?:하지\s*못|되지\s*않)|단정(?:하기|할\s*수)?\s*어렵|(?:효과|변화|이득|개선)(?:가|은|는|을|를)?[^.!?]{0,30}(?:나타나지\s*않|없었|없습니다|확인하지\s*못|관찰되지\s*않)/u;
const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const cleanText=value=>String(value??'').replace(/\s+/gu,' ').trim();

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

function foodAnchor(title){
  return cleanText(title).split(/[\s｜|·(（]/u)[0]??'';
}

function isNarrative(text){
  return Array.from(text).length>MAX_CHARS||SENTENCE_END_PATTERN.test(text)||TERMINAL_PUNCTUATION_PATTERN.test(text);
}

export function assertFoodHighlightPhrases(source){
  if(source?.category!=='음식'||source?.contentStandard!=='SP1'||!source?.id?.startsWith('direct-'))return;
  const marks=collectMarkTexts(source.bodyHtml);
  if(!marks.length)return;
  if(marks.some(text=>!EXISTING_LIMITATION_PATTERN.test(text)&&isNarrative(text)))throw Error('E_DIRECT_FOOD_HIGHLIGHT_NARRATIVE');

  const anchor=foodAnchor(source.title);
  if(anchor&&marks.length>=6){
    const escaped=anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const repeated=new RegExp(`^${escaped}(?:\s|[·+→:-])`,'u');
    const repeatedCount=marks.filter(text=>repeated.test(text)).length;
    if(repeatedCount>=4&&repeatedCount>=Math.ceil(marks.length/2))throw Error('E_DIRECT_FOOD_HIGHLIGHT_SUBJECT_REPEAT');
  }

  // Guard only conspicuous reading gaps, not numeric quotas or mandatory
  // definition/season highlights. This reuses the existing phrase check.
  const sections=[{heading:'__INTRO__',text:'',marks:[]}];
  let current=sections[0];
  const scan=node=>{
    if(node?.name==='h2'){
      current={heading:cleanText(nodeText(node)),text:'',marks:[]};
      sections.push(current);
      return;
    }
    if(node?.name==='mark')current.marks.push(cleanText(nodeText(node)));
    if(node?.type==='text')current.text+=' '+(node.data??'');
    for(const child of node?.children??[])scan(child);
  };
  for(const node of parseDocument(source.bodyHtml??'').children??[])scan(node);
  const opening=sections.find(section=>/^1[.)]\s*소개$/u.test(section.heading));
  const safety=sections.find(section=>/^5[.)]\s*주의사항$/u.test(section.heading));
  const hasSixSections=sections.filter(section=>/^[1-6][.)]\s*/u.test(section.heading)).length===6;
  if(hasSixSections&&opening&&sections[0].marks.length===0&&opening.marks.length===0
      &&Array.from(cleanText(sections[0].text+' '+opening.text)).length>500
      &&/(?:손질|조리|고르|선택|구입|보관|냉장|확인)/u.test(opening.text))
    throw Error('E_DIRECT_FOOD_HIGHLIGHT_OPENING_GAP');
  if(hasSixSections&&safety&&/(?:119|호흡곤란|호흡이 어려워|응급 도움)/u.test(safety.text)
      &&!safety.marks.some(mark=>/(?:119|호흡|응급|즉시\s*(?:섭취|복용)\s*중단)/u.test(mark)))
    throw Error('E_DIRECT_FOOD_HIGHLIGHT_EMERGENCY_GAP');
}
