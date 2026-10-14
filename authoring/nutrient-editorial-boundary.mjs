export const NUTRIENT_EDITORIAL_EXTERNAL_ERROR='E_NUTRIENT_DIRECT_EDITORIAL_EXTERNAL';

export function assertLegacyNutrientAuthoringDisabled(domain){
  if(domain==='nutrient')throw new Error(NUTRIENT_EDITORIAL_EXTERNAL_ERROR);
}
