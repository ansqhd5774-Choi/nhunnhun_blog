import {parseDocument} from 'htmlparser2';

const text=node=>node.type==='text'?node.data:(node.children??[]).map(text).join('');
export function pairingReview(bodyHtml, category='음식') {
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
  const categoryQuestions={
    '영양소':[
      '음식·성분 조합이 공급량이나 흡수에 어떤 역할을 하는지 설명했는가?',
      '정상 생리 기능과 보충제의 추가 효과를 구분했는가?',
      '병용 가능과 추가 이득을 구분하고 실제 원문에 연결했는가?',
      '중복 섭취·상한·약물 상호작용의 필요한 행동을 유지했는가?'
    ],
    '약학':[
      '정확한 제품의 식사·음료·약·영양제 복용 관계를 설명했는가?',
      '허가사항의 복용 조건과 금기·상호작용을 확인했는가?',
      '생활 보조와 약효 증강을 구분하고 근거 없는 궁합을 만들지 않았는가?',
      '독자가 피하거나 확인할 행동을 명확히 적었는가?'
    ],
    '질병':[
      '해당 질환의 식사·운동·수면·생활 관리 역할을 구체적으로 설명했는가?',
      '질환 단계와 대상에 맞는 근거 및 실천 조건을 연결했는가?',
      '생활 관리와 표준 치료의 역할을 구분했는가?',
      '필요한 위험·응급 행동을 유지하며 불필요한 반박을 반복하지 않았는가?'
    ]
  };
  return {heading,combinations,reviewQuestions:categoryQuestions[category]??[
    '각 조합이 어떤 성분·식사 구성을 어떻게 보완하는지 실제 문장으로 설명했는가?',
    '영양 보완, 흡수·상호작용 연구, 맛·조리 활용을 구분하고 근거 수준을 밝혔는가?',
    '소량 고명은 풍미 역할로 설명하고, 각 조합에 불필요한 한계·반박 문장을 반복하지 않았는가?',
    '안전 주의가 궁합의 작용 설명을 대신하지 않았는가?'
  ],assessment:'AUTHOR_REVIEW_REQUIRED'};
}
