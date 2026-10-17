import {DIRECT_AUTHORING_CONTRACT,isDirectSource,hasAuthoritativePreflight} from './direct-authoring-contract.mjs';
import {assertDirectSubmissionEmphasis} from './direct-emphasis.mjs';
import {assertDirectSubmissionFocus} from './direct-focus.mjs';
import {assertImageReview} from './image-review.mjs';
import {assertFoodHighlightPhrases} from './food-highlight-phrase.mjs';
import {assertFoodBenefitBreadth} from './food-benefit-breadth.mjs';

export function directPreflight(source){
  if(!isDirectSource(source))return {status:'NOT_APPLICABLE',contractVersion:DIRECT_AUTHORING_CONTRACT.version};
  if(hasAuthoritativePreflight())return {status:'PREFLIGHT_REUSED',contractVersion:DIRECT_AUTHORING_CONTRACT.version,validatedSha:process.env.GITHUB_SHA,checks:{emphasis:'REUSED',foodHighlightPhrase:'REUSED',foodBenefitBreadth:'REUSED',focus:'REUSED',images:'REUSED'},errors:[],automatedSemanticVerdict:false};
  const checks={},errors=[];
  for(const [name,check] of [['emphasis',assertDirectSubmissionEmphasis],['foodHighlightPhrase',assertFoodHighlightPhrases],['foodBenefitBreadth',assertFoodBenefitBreadth],['focus',assertDirectSubmissionFocus],['images',assertImageReview]]){
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
