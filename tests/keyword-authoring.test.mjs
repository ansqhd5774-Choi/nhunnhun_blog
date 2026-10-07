import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKeywords,keywordId,readPubmed,research,VERIFIED_ALIASES} from '../authoring/keywords.mjs';
test('카르노산을 카르노신으로 오역한 실제 오류의 재발을 막는다',()=>{
  assert.deepEqual(VERIFIED_ALIASES['카르노산'],{domain:'nutrient',englishQuery:'carnosic acid'});
});
test('키워드 정규화·중복·15개 한도',()=>{
  assert.deepEqual(parseKeywords('# 설명\r\n 참기름  보관법\n참기름 보관법\n'),['참기름 보관법']);
  assert.throws(()=>parseKeywords(Array.from({length:16},(_,i)=>`주제${i}`).join('\n')),/E_KEYWORD_INPUT/);
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
