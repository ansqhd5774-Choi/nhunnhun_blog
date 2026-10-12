import {parseDocument} from 'htmlparser2';

const text=node=>node.type==='text'?node.data:(node.children??[]).map(text).join('');

export function pairingReview(bodyHtml, category='음식') {
  if(category!=='음식') throw new Error('E_FOOD_PROJECT_CATEGORY_ONLY');
  const targetSection=4;
  const nodes=parseDocument(bodyHtml).children;
  let section=0,heading='',content=[];
  for(const node of nodes){
    if(node.name==='h2'){
      section++;
      if(section>targetSection)break;
      if(section===targetSection)heading=text(node).trim();
    } else if(section===targetSection)content.push(node);
  }
  const combinations=[];
  const visit=node=>{
    if(node.name==='li')combinations.push(text(node).replace(/\s+/g,' ').trim());
    for(const child of node.children??[])visit(child);
  };
  content.forEach(visit);
  return {
    heading,
    combinations,
    targetSection,
    reviewQuestions:[
      '무엇과 먹으면 좋은지 독자가 바로 알 수 있는가?',
      '왜 좋은지 성분의 실제 작용 또는 영양 보완 이유를 쉬운 말로 설명했는가?',
      '실제로 한 끼에서 어떻게 함께 먹을지 예를 들었는가?',
      '확인된 흡수·상호작용과 단순 풍미·식사 활용을 구분했는가?',
      '근거 없는 시너지나 질병 예방 효과를 만들지 않았는가?',
      '안전 주의가 궁합 설명을 대신하지 않았는가?'
    ],
    assessment:'AUTHOR_REVIEW_REQUIRED'
  };
}
