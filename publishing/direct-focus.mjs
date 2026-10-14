import {parseDocument} from 'htmlparser2';
import {DIRECT_AUTHORING_CONTRACT} from './direct-authoring-contract.mjs';

const UTILITY_HEADING=/^(?:자주 묻는 질문|FAQ|핵심 정리|함께 보면 좋은 글|자료 출처)$/iu;
const PURE_SAFETY_HEADING=/^(?:주의(?:사항)?|부작용(?:과|·)\s*주의(?:사항)?|금기(?:와|·)\s*주의(?:사항)?|응급(?:\s*신호)?|이상반응(?:과|·)\s*주의(?:사항)?)$/u;
const RESEARCH_DETAIL_PATTERNS=[
  /(?:연구에서는|논문에서는|시험에서는)/gu,
  /(?:무작위|이중맹검|대조군|표본\s*(?:수|크기)|통계적(?:으로)?\s*유의)/gu,
  /(?:p\s*[<=>]\s*0?\.\d+|95%\s*(?:CI|신뢰구간)|위험비|오즈비|hazard ratio|odds ratio)/giu,
  /(?:\d{2,5})명(?:을|의)?\s*대상/gu,
];
const LIMITATION_PATTERNS=[
  /(?:근거|자료|연구|증거)(?:가|는|를|도)?\s*(?:부족|충분하지|제한적)/u,
  /(?:확인|입증|검증)(?:하지\s*못|되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)/u,
  /단정(?:하기|할\s*수)?\s*어렵/u,
  /확립(?:(?:되지\s*않|되지\s*않았|되지\s*않은|되지\s*않습니다|되지\s*않았다|되지\s*않음)|(?:(?:돼|되어)\s*있지\s*않))/u,
  /(?:보장|장담)(?:할\s*수)?\s*없/u,
  /(?:효과|변화|이득|개선)(?:가|은|는|을|를)?[^.!?]{0,30}(?:나타나지\s*않|없었|없습니다|확인하지\s*못|관찰되지\s*않)/u,
  /(?:(?:비교\s*가능한)\s*)?(?:공식\s*)?(?:자료|데이터(?:베이스)?|기준)(?:가|는)?\s*(?:없|마련되지\s*않)/u,
  /(?:모든|누구나)[^.!?]{0,40}(?:필요|먹어야|복용해야|섭취해야)[^.!?]{0,25}(?:아니|아닙|없)/u,
];
const NUTRIENT_EXPECTED_CHANGE_HEADING=/(?:효능|효과|기대\s*변화|어떤\s*변화|누가\s*(?:먹|섭취|복용)|먹으면\s*좋)/u;
const HUMAN_EVIDENCE_PATTERN=/(?:사람|성인|환자|참가자|대상자|인체|임상|무작위)/u;
const OBSERVED_CHANGE_PATTERN=/(?:개선|증가|감소|낮아|높아|줄(?:었|어|어들|어드는|이는)|완화|향상|회복|유지|변화|호전)/u;
const STUDY_DURATION_PATTERN=/(?:^|[^0-9])\d{1,3}(?:\.\d+)?\s*(?:일|주|개월|달|년)(?:간|동안|후)?(?:[^0-9]|$)/u;
const INTAKE_AMOUNT_PATTERN=/(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(?:μg|mcg|mg|g|IU|국제단위|mL|ml|정|캡슐)(?:\/일|\s*\/\s*일|\s*하루)?/iu;
const NUTRIENT_FOOD_RANKING_HEADING=/(?=.*(?:식품|음식))(?=.*(?:TOP\s*(?:7|5|3)|상위\s*(?:7|5|3)))/iu;
const ESTIMATED_RANKING_VALUE_PATTERN=/(?:\d[\d.,~～\-–—]*\s*(?:μg|mcg|mg|g)(?:\s*\/\s*(?:100\s*g|회|1회|일))?[^.!?\n]{0,24}(?:추정|환산|계산(?:값|치)?))|(?:(?:추정|환산|계산(?:값|치)?)[^.!?\n]{0,24}\d[\d.,~～\-–—]*\s*(?:μg|mcg|mg|g))|(?:\d+(?:\.\d+)?\s*%[^.!?\n]{0,30}(?:배합|함유)[^.!?\n]{0,30}(?:적용|환산|계산))/iu;

const nodeText=node=>node?.type==='text'?(node.data??''):(node?.children??[]).map(nodeText).join('');
const clean=value=>String(value??'').replace(/\s+/gu,' ').trim();
const countMatches=(text,patterns)=>patterns.reduce((sum,pattern)=>sum+([...text.matchAll(new RegExp(pattern.source,pattern.flags))].length),0);
const limitationSentences=text=>(String(text).match(/[^.!?]+[.!?]?/gu)??[]).map(clean).filter(Boolean)
  .filter(sentence=>LIMITATION_PATTERNS.some(pattern=>pattern.test(sentence)));

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
  const limitationFindings=[];
  for(const section of sections){
    if(/^자료 출처$/u.test(section.heading))continue;
    const text=clean(section.text);
    researchDetailHits+=countMatches(text,RESEARCH_DETAIL_PATTERNS);
    if(!PURE_SAFETY_HEADING.test(section.heading)){
      const hits=limitationSentences(text);
      limitationHits+=hits.length;
      limitationFindings.push(...hits.map(match=>({heading:section.heading,match})));
    }
  }
  const nutrientExpectedChangeSections=sections
    .filter(section=>section.heading!=='__INTRO__'&&!UTILITY_HEADING.test(section.heading)&&NUTRIENT_EXPECTED_CHANGE_HEADING.test(section.heading))
    .map(section=>{
      const text=clean(section.text);
      return {
        heading:section.heading,
        hasHumanEvidence:HUMAN_EVIDENCE_PATTERN.test(text),
        hasObservedChange:OBSERVED_CHANGE_PATTERN.test(text),
        hasStudyDuration:STUDY_DURATION_PATTERN.test(text),
        hasIntakeAmount:INTAKE_AMOUNT_PATTERN.test(text),
      };
    });
  const nutrientFoodRankingSections=sections
    .filter(section=>section.heading!=='__INTRO__'&&!UTILITY_HEADING.test(section.heading)&&NUTRIENT_FOOD_RANKING_HEADING.test(section.heading))
    .map(section=>{
      const text=clean(section.text);
      return {
        heading:section.heading,
        hasEstimatedRankingValue:ESTIMATED_RANKING_VALUE_PATTERN.test(text),
      };
    });
  return {coreHeadings,utilityHeadings,researchDetailHits,limitationHits,limitationFindings:limitationFindings.slice(0,12),nutrientExpectedChangeSections,nutrientFoodRankingSections};
}

// Shared direct/SP1 structure guard. Food editorial-balance counts are advisory metrics only:
// simplistic word counts must not force authors to delete accurate evidence or rewrite facts merely to pass CI.
export function assertDirectSubmissionFocus(source) {
  if(source?.contentStandard!=='SP1'||!source?.id?.startsWith('direct-'))return;
  const review=directFocusReview(source.bodyHtml??'');
  if(review.coreHeadings.length>DIRECT_AUTHORING_CONTRACT.coreHeadingMaximum)throw Error('E_DIRECT_FOCUS_SECTION_OVERLOAD');
  if(source.category==='영양소'){
    if(!review.nutrientExpectedChangeSections.length)throw Error('E_DIRECT_NUTRIENT_EXPECTED_CHANGE_SECTION_MISSING');
    const humanSections=review.nutrientExpectedChangeSections.filter(section=>section.hasHumanEvidence);
    if(humanSections.length&&humanSections.every(section=>!(section.hasObservedChange&&section.hasStudyDuration&&section.hasIntakeAmount)))
      throw Error('E_DIRECT_NUTRIENT_EXPECTED_CHANGE_INCOMPLETE');
    if(review.nutrientFoodRankingSections.some(section=>section.hasEstimatedRankingValue))
      throw Error('E_DIRECT_NUTRIENT_FOOD_RANKING_ESTIMATED_VALUE');
  }
  return review;
}
