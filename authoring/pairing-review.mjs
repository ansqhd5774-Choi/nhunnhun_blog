import {parseDocument} from 'htmlparser2';

const text=node=>node.type==='text'?node.data:(node.children??[]).map(text).join('');
export function pairingReview(bodyHtml) {
  const nodes=parseDocument(bodyHtml).children;
  let section=0,heading='',content=[];
  for(const node of nodes){
    if(node.name==='h2'){
      section++;
      if(section>4)break;
      if(section===4)heading=text(node).trim();
    } else if(section===4)content.push(node);
  }
  const combinations=[];
  const visit=node=>{
    if(node.name==='li')combinations.push(text(node).replace(/\s+/g,' ').trim());
    for(const child of node.children??[])visit(child);
  };
  content.forEach(visit);
  return {heading,combinations,reviewQuestions:[
    '각 조합이 어떤 성분·식사 구성을 어떻게 보완하는지 실제 문장으로 설명했는가?',
    '영양 보완, 흡수·상호작용 연구, 맛·조리 활용을 구분하고 근거 수준을 밝혔는가?',
    '소량 고명처럼 기여가 작은 경우 과장하지 않고 한계를 설명했는가?',
    '안전 주의가 궁합의 작용 설명을 대신하지 않았는가?'
  ],assessment:'AUTHOR_REVIEW_REQUIRED'};
}
