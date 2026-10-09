/* Category reading paths and public editorial policy. No requests or trackers. */
(function () {
  'use strict';
  function run() {
    var content = document.querySelector('#content');
    if (!content || document.body.id !== 'tt-body-category' || document.getElementById('nh-category-guide')) return;
    var name = decodeURIComponent(location.pathname).split('/').filter(Boolean).pop();
    var guides = {
      '음식': ['식품의 영양·칼로리·섭취·궁합·보관 기준을 함께 살펴보세요.', [['/395','석류 선택과 보관'],['/282','밀배아 영양과 섭취'],['/406','마라탕 재료와 나트륨']]],
      '영양소': ['성분의 역할, 식품 공급원과 섭취 시 확인할 기준을 정리합니다.', [['/110','사포닌 이해하기'],['/112','카페인 작용과 섭취']]],
      '약약': ['약의 사용법·허가사항·상호작용과 주의사항을 확인합니다.', [['/313','마데카솔 종류와 사용법'],['/264','감기약 중복복용 확인']]],
      '질병': ['증상을 이해하고 진료와 생활 관리에 필요한 정보를 살펴보세요.', [['/376','감기와 독감 증상 차이']]]
    };
    var guide = guides[name];
    if (!guide) return;
    var section = document.createElement('section');
    section.id = 'nh-category-guide';
    section.setAttribute('aria-label', '카테고리 안내');
    section.style.cssText='max-width:810px;margin:24px auto;padding:20px 24px;border:1px solid #dce5dc;border-radius:12px;background:#f7f9f5;box-sizing:border-box';
    var title = document.createElement('h1'); title.textContent=name==='약약'?'약학':name; title.style.cssText='font-size:24px;margin:0 0 12px'; section.appendChild(title);
    var description = document.createElement('p'); description.textContent=guide[0]; section.appendChild(description);
    var links = document.createElement('ul'); links.style.cssText='display:flex;gap:12px 24px;flex-wrap:wrap;margin:16px 0 0;padding-left:20px';
    guide[1].forEach(function(pair){var item=document.createElement('li');var a=document.createElement('a');a.href=pair[0];a.textContent=pair[1];item.appendChild(a);links.appendChild(item);});
    section.appendChild(links); content.insertBefore(section,content.firstChild);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
