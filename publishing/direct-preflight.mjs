import {DIRECT_AUTHORING_CONTRACT,isDirectSource,hasAuthoritativePreflight} from './direct-authoring-contract.mjs';
import {assertDirectSubmissionEmphasis} from './direct-emphasis.mjs';
import {assertDirectSubmissionFocus} from './direct-focus.mjs';
import {assertImageReview} from './image-review.mjs';
import {assertFoodHighlightPhrases} from './food-highlight-phrase.mjs';
import {assertFoodBenefitBreadth} from './food-benefit-breadth.mjs';
import {assertVerifiedFoodStockLeadRemoval} from './food-stock-lead-removal.mjs';

// Food summaries must be written only when they add a distinct reader benefit.
// The old stock lead was inserted across many published articles and repeated
// the same information already present in their six main sections.
export function assertFoodNoStockLead(source){
  if(source?.category!=='음식'||!source?.id?.startsWith('direct-'))return;
  if(/핵심(?:만)?\s*먼저\s*:?/u.test(source.bodyHtml??''))
    throw Error('E_DIRECT_FOOD_STOCK_LEAD');
}

export function directPreflight(source){
  if(!isDirectSource(source))return {status:'NOT_APPLICABLE',contractVersion:DIRECT_AUTHORING_CONTRACT.version};
  if(source.changeScope==='stock-lead-removal'){
    try{
      assertVerifiedFoodStockLeadRemoval(source);
      assertFoodNoStockLead(source);
      return {status:'PREFLIGHT_PASS',contractVersion:DIRECT_AUTHORING_CONTRACT.version,checks:{verifiedBaseline:'PASS',stockLead:'PASS',otherContent:'UNCHANGED'},errors:[],automatedSemanticVerdict:false};
    }catch(error){
      const code=/^E_[A-Z0-9_]+$/.test(error?.message??'')?error.message:'E_STOCK_LEAD_PREFLIGHT';
      return {status:'FAIL',contractVersion:DIRECT_AUTHORING_CONTRACT.version,checks:{verifiedBaseline:code},errors:[code],automatedSemanticVerdict:false};
    }
  }
  if(hasAuthoritativePreflight())return {status:'PREFLIGHT_REUSED',contractVersion:DIRECT_AUTHORING_CONTRACT.version,validatedSha:process.env.GITHUB_SHA,checks:{stockLead:'REUSED',emphasis:'REUSED',foodHighlightPhrase:'REUSED',foodBenefitBreadth:'REUSED',focus:'REUSED',images:'REUSED'},errors:[],automatedSemanticVerdict:false};
  const checks={},errors=[];
  for(const [name,check] of [['stockLead',assertFoodNoStockLead],['emphasis',assertDirectSubmissionEmphasis],['foodHighlightPhrase',assertFoodHighlightPhrases],['foodBenefitBreadth',assertFoodBenefitBreadth],['focus',assertDirectSubmissionFocus],['images',assertImageReview]]){
    try{check(source);checks[name]='PASS';}
    catch(error){const code=/^E_[A-Z0-9_]+$/.test(error.message)?error.message:'E_DIRECT_PREFLIGHT_RUNTIME';checks[name]=code;errors.push(code);}
  }
  return {status:errors.length?'FAIL':'PREFLIGHT_PASS',contractVersion:DIRECT_AUTHORING_CONTRACT.version,checks,errors,automatedSemanticVerdict:false};
}
export function assertDirectPreflight(source){
  const result=directPreflight(source);
  if(result.status==='FAIL')throw Error(result.errors[0]);
  return result;
}
