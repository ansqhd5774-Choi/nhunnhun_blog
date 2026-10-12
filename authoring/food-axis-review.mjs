const FOOD_AXES = [
  {
    expectedAxis:'정의·주요 성분·작용',
    readerQuestion:'이 음식은 무엇이고, 주요 성분·작용은 무엇인가?',
    reviewQuestion:'H2와 첫 문장이 음식의 정체와 주요 성분·작용을 직접 답하는가?'
  },
  {
    expectedAxis:'핵심 효능·예방 효과',
    readerQuestion:'이 음식의 핵심 효능은 무엇이며, 사람에게 어디까지 확인됐는가?',
    reviewQuestion:'제목·검색 의도가 효능·건강 효과를 약속한다면 H2와 첫 문장이 그 효능과 확인 범위를 직접 답하는가? ‘확인된 작용’, 감각, 연구 한계, 안전, 맛 설명만으로 이 축을 대신하지 않았는가?'
  },
  {
    expectedAxis:'섭취법·권장량',
    readerQuestion:'얼마나·어떻게 먹는가? 공식 권장량이 있는가?',
    reviewQuestion:'H2와 첫 문장이 실제 섭취 방법·양·공식 권장량 유무를 직접 답하는가?'
  },
  {
    expectedAxis:'궁합·상호작용',
    readerQuestion:'무엇과 먹으면 좋고, 실제 상호작용인지 단순 풍미 조합인지?',
    reviewQuestion:'H2와 첫 문장이 무엇과 먹는지와 이유를 답하고 실제 작용·흡수와 단순 풍미 조합을 구분하는가?'
  },
  {
    expectedAxis:'부작용·주의 대상',
    readerQuestion:'부작용은 무엇이고 누가 주의해야 하는가?',
    reviewQuestion:'H2와 첫 문장이 정상 반응·부작용·주의 대상을 구분해 직접 답하는가?'
  },
  {
    expectedAxis:'신선도·보관·조리 팁',
    readerQuestion:'신선한 것을 어떻게 고르고, 보관·조리하면 좋은가?',
    reviewQuestion:'H2와 첫 문장이 고르는 기준과 보관·조리 행동을 구체적으로 답하는가?'
  }
];

const AUX_HEADING_RE=/(FAQ|자주\s*묻|핵심\s*정리|자료\s*출처|출처)/i;

function decodeHtml(text){
  return String(text??'')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&#x27;/gi,"'");
}

function textOnly(html){
  return decodeHtml(String(html??'')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' '))
    .replace(/\s+/g,' ')
    .trim();
}

function firstAnswer(segment){
  const blocks=String(segment??'').matchAll(/<(p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  for(const match of blocks){
    const answer=textOnly(match[2]);
    if(answer)return answer;
  }
  return '';
}

export function buildFoodAxisReview(source={}){
  const html=String(source.bodyHtml??'');
  const coreHeadings=[...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map(match=>({index:match.index??0,end:(match.index??0)+match[0].length,heading:textOnly(match[1])}))
    .filter(item=>item.heading&&!AUX_HEADING_RE.test(item.heading))
    .slice(0,6);

  const axes=FOOD_AXES.map((definition,index)=>{
    const item=coreHeadings[index];
    const next=coreHeadings[index+1];
    const segment=item?html.slice(item.end,next?.index??html.length):'';
    return {
      axis:index+1,
      ...definition,
      heading:item?.heading??'',
      firstAnswer:firstAnswer(segment)
    };
  });

  return {
    assessment:'AUTHOR_REVIEW_REQUIRED',
    automatedSemanticVerdict:false,
    observedCoreH2Count:coreHeadings.length,
    axes
  };
}
