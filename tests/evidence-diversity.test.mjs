import test from 'node:test';
import assert from 'node:assert/strict';
import {isUsdaSource,isHumanOutcomeSource,selectDiverseEvidenceSources} from '../authoring/evidence-diversity.mjs';
import {collectEvidence,classifyEvidenceSufficiency} from '../authoring/queue-research.mjs';
import {selectPlanSources} from '../authoring/queue-plan.mjs';

const source=(id,kind,role,topicSpecific=true,url=`https://example.org/${id}`)=>({id,url,kind,role,topicSpecific,title:id,notes:id});

test('human outcomes outrank USDA regardless of input order',()=>{
  const usda=source('usda-fdc-1','nutrition-database','nutrition',true,'https://fdc.nal.usda.gov/food-details/1/nutrients');
  const trial=source('pmid-100','trial','health',true,'https://pubmed.ncbi.nlm.nih.gov/100/');
  const review=source('pmid-101','systematic-review','health',true,'https://pubmed.ncbi.nlm.nih.gov/101/');
  const official=source('guide','official','safety',true,'https://foodsafetykorea.go.kr/guide');
  assert.equal(isUsdaSource(usda),true);
  assert.equal(isHumanOutcomeSource(usda),false);
  assert.equal(isHumanOutcomeSource(trial),true);
  const got=selectDiverseEvidenceSources([usda,official,trial,review],{limit:4}).map(x=>x.id);
  assert.deepEqual(got.slice(0,2),['pmid-100','pmid-101']);
  assert.ok(got.includes('usda-fdc-1'));
});
test('large source lists retain independent human outcomes and a food composition lookup',()=>{
  const bulk=Array.from({length:20},(_,i)=>source('general-'+i,'official','safety',false));
  const usda=source('usda-fdc-7','nutrition-database','nutrition',true,'https://fdc.nal.usda.gov/food-details/7/nutrients');
  const korean=source('krdb','nutrition-database','nutrition',true,'https://foodsafetykorea.go.kr/nutrients/7');
  const trial=source('trial','trial','health');
  const review=source('review','systematic-review','health');
  const got=selectDiverseEvidenceSources([usda,...bulk,korean,trial,review],{limit:7});
  assert.equal(got.length,7);
  assert.deepEqual(got.slice(0,2).map(x=>x.id),['trial','review']);
  assert.ok(got.some(s=>s.id==='krdb'));
  assert.ok(got.some(s=>s.id==='usda-fdc-7'));
});
test('duplicate documents are removed; absent health studies never invented',()=>{
  const usda=source('usda','nutrition-database','nutrition',true,'https://fdc.nal.usda.gov/food-details/2/nutrients');
  assert.deepEqual(selectDiverseEvidenceSources([usda,{...usda},usda],{limit:10}).map(x=>x.id),['usda']);
  assert.throws(()=>selectDiverseEvidenceSources([],{limit:0}),/E_EVIDENCE_SELECTION_LIMIT/);
});
test('USDA plus generic official sources cannot pass as full human benefit evidence',()=>{
  const usda=source('usda','nutrition-database','nutrition',true,'https://fdc.nal.usda.gov/food-details/3/nutrients');
  const generic1=source('generic1','official','health',false);
  const generic2=source('generic2','official','safety',false);
  assert.deepEqual(classifyEvidenceSufficiency({domain:'food'},[usda,generic1,generic2],usda),
    {directCount:1,strongCount:0,claimMode:'conservative'});
});
test('food collection does not call USDA without explicit composition opt-in',async()=>{
  const calls=[];
  const fetcher=async url=>{
    const href=String(url);calls.push(href);
    if(href.includes('eutils.ncbi.nlm.nih.gov'))return {ok:true,status:200,json:async()=>({esearchresult:{idlist:[]}})};
    if(href.includes('api.nal.usda.gov'))throw new Error('UNEXPECTED_USDA_CALL');
    return {ok:false,status:404};
  };
  const res=await collectEvidence({keyword:'계란',domain:'food'},'<html><body>계란</body></html>',{fetcher,advisory:true});
  assert.equal(res.nutrition.available,false);
  assert.equal(res.nutrition.status,'not-requested');
  assert.ok(calls.filter(c=>c.includes('eutils.ncbi.nlm.nih.gov')).length>=3);
  assert.equal(calls.filter(c=>c.includes('api.nal.usda.gov')).length,0);
});
test('USDA explicit opt-in still works for a food composition measurement',async()=>{
  const calls=[];
  const fetcher=async url=>{
    const href=String(url);calls.push(href);
    if(href.includes('eutils.ncbi.nlm.nih.gov'))return {ok:true,status:200,json:async()=>({esearchresult:{idlist:[]}})};
    if(href.includes('api.nal.usda.gov'))return {ok:true,status:200,json:async()=>({foods:[{fdcId:1,description:'Egg, whole, raw',foodNutrients:[{nutrientName:'Protein',value:12.6,unitName:'g'}]}]})};
    return {ok:false,status:404};
  };
  const res=await collectEvidence({keyword:'계란',domain:'food'},'<html><body>계란</body></html>',{fetcher,advisory:true,includeUsdaNutrition:true});
  assert.equal(calls.filter(c=>c.includes('api.nal.usda.gov')).length,1);
  assert.equal(res.nutrition.available,true);
  assert.ok(res.sources.some(s=>s.kind==='nutrition-database'));
  assert.notEqual(res.evidenceProfile.claimMode,'full');
});

test('food article planning starts with a topical human outcome, not USDA',()=>{
  const nutrition=source('usda','nutrition-database','nutrition',true,'https://fdc.nal.usda.gov/food-details/9/nutrients');
  const trial=source('trial','trial','health',true);
  const review=source('review','systematic-review','health',true);
  const safety=source('safety','official','safety',true);
  const chosen=selectPlanSources({sources:[nutrition,safety,trial,review]},{domain:'food'});
  assert.equal(chosen[0].role,'health');
  assert.ok(chosen.some(s=>s.id==='usda'));
  assert.equal(chosen[0].id==='trial'||chosen[0].id==='review',true);
});
