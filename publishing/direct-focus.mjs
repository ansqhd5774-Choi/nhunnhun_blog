import {parseDocument} from 'htmlparser2';

const UTILITY_HEADING=/^(?:자주 묻는 질문|FAQ|핵심 정리|함께 보면 좋은 글|자료 출처)$/iu;
const SAFETY_HEADING=/(?:주의|부작용|금기|위험|응급|이상반응)/u;
const RESEARCH_DETAIL_PATTERNS=[
  /(?:연구에서는|논문에서는|시험에서는)/gu,
  /(?:무작위|이중맹검|대조군|표본\s*(?:수|크기)|통계적(?:으로)?\s*유의)/gu,
  /(?:p\s*[<=>]\s*0?\.\d+|95%\s*(?:CI|신뢰구간)|위험비|오즈비|hazard ratio|odds ratio)/giu,
  /(?:\d{2,5})명(?:을|의)?\s*대상/gu,
];
const LIMITATION_PATTERNS=[
  /(?:근거|자료|연구|증거)(?:가|는|를)?\s*(?:부족|충분하지|제한적)/gu,
  /(?:확인|입증|검증)(?:되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)/gu,
  /단정(?:하기|할\s*수)?\s*어렵/gu,
  /확립(?:되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)/gu,
];

const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const clean=value=>String(value??'').replace(/\s+/gu,' ').trim();
const countMatches=(text,patterns)=>patterns.reduce((sum,pattern)=>sum+([...text.matchAll(new RegExp(pattern.source,pattern.flags))].length),0);

export function directFocusReview(bodyHtml='') {
  const root=parseDocument(String(bodyHtml));
  const sections=[];
  let current={heading:'__INTRO__',text:''};
  sections.push(current);
  const visit=node=>{
    if(node.name==='h2'){
      current={heading:clean(nodeText(node)).replace(/^\d+[.)]\s*/u,''),text:''};
      sections.push(current);
      return;
    }
    if(node.type==='text')current.text+=' '+(node.data??'');
    for(const child of node.children??[])visit(child);
  };
  for(const child of root.children??[])visit(child);
  const headings=sections.filter(s=>s.heading!=='__INTRO__').map(s=>s.heading);
  const coreHeadings=headings.filter(h=>!UTILITY_HEADING.test(h));
  const utilityHeadings=headings.filter(h=>UTILITY_HEADING.test(h));
  let researchDetailHits=0,limitationHits=0;
  for(const section of sections){
    if(/^자료 출처$/u.test(section.heading))continue;
    const text=clean(section.text);
    researchDetailHits+=countMatches(text,RESEARCH_DETAIL_PATTERNS);
    if(!SAFETY_HEADING.test(section.heading))limitationHits+=countMatches(text,LIMITATION_PATTERNS);
  }
  return {coreHeadings,utilityHeadings,researchDetailHits,limitationHits};
}

// Deterministic structure guard only. It does not judge medical truth or rewrite prose.
export function assertDirectSubmissionFocus(source) {
  if(source?.contentStandard!=='SP1'||!source?.id?.startsWith('direct-'))return;
  const review=directFocusReview(source.bodyHtml??'');
  if(review.coreHeadings.length>6)throw Error('E_DIRECT_FOCUS_SECTION_OVERLOAD');
  if(review.researchDetailHits>2)throw Error('E_DIRECT_FOCUS_RESEARCH_OVERLOAD');
  if(review.limitationHits>2)throw Error('E_DIRECT_FOCUS_LIMITATION_OVERLOAD');
  return review;
}
