import {parseDocument} from 'htmlparser2';

const MAX_CHARS=32;
const SENTENCE_END_PATTERN=/(?:습니다|합니다|됩니다|입니다|아닙니다|있습니다|없습니다|좋습니다|쉽습니다|어렵습니다|됩니다|해요|이에요|예요)$/u;
const TERMINAL_PUNCTUATION_PATTERN=/[.!?。]$/u;
const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const cleanText=value=>String(value??'').replace(/\s+/gu,' ').trim();

function collectMarkTexts(html){
  const texts=[];
  const visit=node=>{
    if(node?.name==='mark'){
      const text=cleanText(nodeText(node));
      if(text)texts.push(text);
    }
    for(const child of node?.children??[])visit(child);
  };
  visit(parseDocument(html??''));
  return texts;
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
  if(marks.some(isNarrative))throw Error('E_DIRECT_FOOD_HIGHLIGHT_NARRATIVE');

  const anchor=foodAnchor(source.title);
  if(anchor&&marks.length>=6){
    const escaped=anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const repeated=new RegExp(`^${escaped}(?:\\s|[·+→:-])`,'u');
    const repeatedCount=marks.filter(text=>repeated.test(text)).length;
    if(repeatedCount>=4&&repeatedCount>=Math.ceil(marks.length/2))throw Error('E_DIRECT_FOOD_HIGHLIGHT_SUBJECT_REPEAT');
  }
}
