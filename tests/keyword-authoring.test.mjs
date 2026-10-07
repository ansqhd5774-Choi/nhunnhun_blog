import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKeywords,keywordId,readPubmed,research,VERIFIED_ALIASES,keywordArticleSchema} from '../authoring/keywords.mjs';
test('모델의 출처 ID를 실제 조회 자료로 제한한다',()=>{
  const schema=keywordArticleSchema([{id:'pmid-123'},{id:'pmid-456'}]);
  assert.deepEqual(schema.properties.sections.items.properties.sourceIds.items.enum,['pmid-123','pmid-456']);
});
test('카르노산을 카르노신으로 오역한 실제 오류의 재발을 막는다',()=>{
  assert.deepEqual(VERIFIED_ALIASES['카르노산'],{domain:'nutrient',englishQuery:'carnosic acid'});
});
test('키워드 정규화·중복 제거, 생성 개수는 발행 한도와 분리',()=>{
  assert.deepEqual(parseKeywords('# 설명\r\n 참기름  보관법\n참기름 보관법\n'),['참기름 보관법']);
  const many=Array.from({length:101},(_,i)=>`주제${i}`);
  assert.deepEqual(parseKeywords(many.join('\n')),many);
  assert.throws(()=>parseKeywords('주'.repeat(121)),/E_KEYWORD_INPUT/);
  assert.equal(keywordId('참기름'),keywordId('참기름'));
  assert.notEqual(keywordId('참기름'),keywordId('들기름'));
});
test('실제 PMID와 초록 없는 자료를 출처로 만들지 않는다',()=>{
  const xml='<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>A &amp; B</ArticleTitle><Abstract><AbstractText>Human trial &lt;small&gt;.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle><PubmedArticle><MedlineCitation><PMID>124</PMID><Article><ArticleTitle>No abstract</ArticleTitle></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>';
  const sources=readPubmed(xml);assert.equal(sources.length,1);assert.equal(sources[0].url,'https://pubmed.ncbi.nlm.nih.gov/123/');assert.equal(sources[0].title,'A & B');assert.equal(sources[0].evidenceScope,'indexed-abstract-only');
});
test('조사 부족·검색식 오염 시 모델 본문 단계에 진입하지 않는다',async()=>{
  await assert.rejects(research('carno AND [key]',()=>{throw Error('should not call');}),/E_RESEARCH_QUERY/);
  await assert.rejects(research('carnosic acid',async()=>({ok:true,json:async()=>({esearchresult:{idlist:['123']}})})),/E_RESEARCH_INSUFFICIENT/);
});
test('Queue 근거 수집은 직접 PubMed 초록 1건도 보수적 근거로 유지할 수 있다',async()=>{
  const xml='<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>Niacin evidence</ArticleTitle><Abstract><AbstractText>Direct evidence for niacin.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>';
  const fetcher=async url=>String(url).includes('esearch.fcgi')
    ?{ok:true,json:async()=>({esearchresult:{idlist:['123']}})}
    :{ok:true,text:async()=>xml};
  const sources=await research('niacin',fetcher,{retmax:5,sort:'pub date',minResults:1});
  assert.equal(sources.length,1);
  assert.equal(sources[0].id,'pmid-123');
});
