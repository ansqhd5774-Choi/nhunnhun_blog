export function directFixture(overrides={}){
 const category=overrides.category??'음식';
 const review=['A','B','C'].map((name,i)=>({src:`https://commons.wikimedia.org/wiki/Special:Redirect/file/Fruit_${name}.jpg?width=960`,alt:'과일의 형태와 색을 보여주는 사진',role:i?'context':'hero',composition:i?'context':'closeup',sourcePage:`https://commons.wikimedia.org/wiki/File:Fruit_${name}.jpg`,author:'Fixture Author',license:'CC BY-SA 4.0'}));
 const images=review.map(r=>`<p><img src="${r.src}" alt="${r.alt}"></p>`).join('');
 const sections=['소개','핵심 정보','역할과 효과','연결과 활용','주의사항','실천과 관리'].map(h=>{
  const highlighted=category==='영양소'&&h==='역할과 효과'?'건강 지표가 개선되고 필요한 기능 유지에 도움이 됩니다.':'주요 수치와 조건';
  const tone=category==='영양소'&&h==='역할과 효과'?' data-tone="positive"':'';
  return `<h2>${h}</h2><ul><li><strong>핵심</strong><strong>기준</strong><mark${tone}><strong>${highlighted}</strong></mark></li></ul>`;
 }).join('');
 const extras=Array.from({length:8},(_,i)=>`<mark data-tone="info"><u><strong>중요한 실천 행동 ${i+1}</strong></u></mark>`).join('');
 const extraBold=Array.from({length:2},(_,i)=>`<strong>보조 핵심 ${i+1}</strong>`).join('');
 return {id:'direct-179-test',articleId:'179',targetUrl:'https://nhunnhun.tistory.com/179',expectedCurrentTitle:'감자',title:'감자',category:'음식',contentStandard:'SP1',status:'ready',approved:true,representativeImageUrl:review[0].src,imageReview:review,bodyHtml:images+sections+`<p>${extras}${extraBold}</p>`+'<h2>자료 출처</h2><ul>'+review.map(r=>`<li><a href="${r.sourcePage}">사진 출처</a></li>`).join('')+'</ul>',...overrides};
}
