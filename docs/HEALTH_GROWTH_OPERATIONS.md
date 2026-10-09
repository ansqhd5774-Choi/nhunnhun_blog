# 한입 건강 검색·갱신·운영 계약

대상: https://nhunnhun.tistory.com/ 의 음식·영양소·약학·질병. 기존 직접 작성·강조·제목·이미지·발행 계약을 유지한다. 여행·쿠폰 기준을 가져오지 않는다. 검색 운영은 매 글 발행 게이트가 아니며 의미 자동 판정·자동 재작성·추가 발행 workflow를 만들지 않는다.

## 작성과 갱신 (1~9)

1. 검색 의도·제목 일치: 핵심 질문, 도입의 답, 해당 소제목, 본문의 충분한 답을 작성자가 확인한다. HEALTH_TITLE_SCOPE를 우선한다.
2. 유형별 구성: 음식은 기존 직접 작성 계약, 영양소·약학·질병은 DOMAIN_GUIDES를 적용한다. 공통 템플릿으로 실제 질문을 밀어내지 않는다.
3. 중복: 제목 문자열만 비교하지 않고 같은 질문·답·대상인지 비교한다. 같은 의도는 기존 숫자 URL 수정 우선. 삭제·통합·redirect는 별도 구체적인 변경 검토 후 실행한다.
4. 근거 추적: 주요 주장/표에 출처, 원문 URL, 대상, 중량·상태·단위, 확인일을 연결한다. 자동 링크 수집은 의미 검증이 아니다.
5. 충돌: 원문 대상·조건·측정법·시점을 비교한다. unresolved는 근거 차이로 남기며 임의 평균·확정값을 만들지 않는다.
6. 날짜: publishedAt, revisedAt, sourceCheckedAt을 구분. 메타데이터 정리만으로 본문 개정일을 새로 만들지 않는다.
7. 재검토: 약학 허가·질병 지침 및 안전정보 30일, 섭취 기준/권고 90일, 안정적인 영양표 365일을 초기 운영 목표로 둔다. 실제 정정·회수·안전 공지는 정기기한보다 우선한다. 이는 의학적 검증 보장이나 발행 차단 기한이 아니다.
8. 우선순위: 확인된 안전 변경 > 수치/단위 오류 > 출처 충돌 > 기한 초과 > 검색 성과. 기존 글 전체 재작성은 자동 실행하지 않는다.
9. 출처 감지: 원문 변화/조회 실패/검토 중/확인 완료를 구분. 403·timeout으로 근거를 삭제하지 않는다. 변경 후보를 사람이 확인한 후 기존 update 경로 사용.

기록: `sourceId, publicUrl, claim, sourceUrl, sourceCheckedAt, effectiveDate, nextReviewAt, status, priority, evidence, revisionReason`. 모르는 날짜는 null, 확인되지 않은 상태는 UNKNOWN. 기존 source 스키마에 불필요한 필수 필드를 추가하지 않고 운영 기록으로 분리한다.

## 검색 운영 (10~17, 21~23)

10. URL별 Google/Naver/Bing 발견·수집·색인·제외 사유와 확인 시점·기관을 기록한다. site: 검색은 전체 색인 증거가 아니다.
11~13. 해당 사이트 소유권·사이트맵 처리·오류·성과를 각 공식 관리 도구에서 확인. 과거 등록 증거와 현재 조회 결과를 구분하며 HTTP 페이지 접근으로 등록 완료를 추정하지 않는다.
14. IndexNow는 원래 호스트에서 소유 확인 키를 제공할 수 있을 때만 사용. Tistory에서 키 제공 경로가 확인되지 않으면 후순위로 남기고 sitemap/Bing 관리 경로 유지. 다른 호스트 키나 허위 keyLocation으로 우회하지 않는다. 제출 응답은 색인 완료가 아니다.
15. sitemap URL 중복·대표 URL·오류와 독립 공개 글 목록/검증된 ledger를 대조. sitemap만으로 sitemap 누락 0이라고 결론 내리지 않는다.
16. canonical·내부링크·사이트맵 대표 URL 통일. robots 차단/noindex/인증 차단을 구분. 티스토리 관리 robots/sitemap을 직접 배포할 수 있다고 가정하지 않는다.
17. raw HTTP 본문 관찰, 실제 브라우저 렌더, 검색엔진 URL 검사 결과를 분리한다. 본문·표·출처·링크를 비교하며 원문 존재를 Googlebot 검증 PASS로 쓰지 않는다.
21. 고유 title/description, 건강정보 중심의 제목-본문 일치. CTR만을 이유로 과장 효능을 추가하지 않는다.
22. JSON-LD 파싱·유형·공개 내용 일치·공식 유효성 검사를 구분. Article은 실제 글에만 적용하고 자동 파싱 성공을 검색 노출 보장으로 보고하지 않는다.
23. 사이트명·로고·favicon·HTTPS·OG 제목/설명/대표 이미지 일관성. 인증/광고 식별자 제거 사본을 실제 스킨으로 배포하지 않는다.

## 탐색과 품질 (18~20, 24~26)

18. 홈→카테고리→페이지 이동→글 링크를 따라 공개 글 도달성 검사. traversal 중단/자바스크립트 링크 등으로 발견되지 않은 글은 고립 후보이며 확정하지 않는다.
19. 카테고리 허브는 기존 분류·URL·디자인을 보존하고 소개/주요 글 탐색을 보완한다. 신규 페이지 발행은 초안 ready 저장으로 자동 시작하지 않는다.
20. 음식→주요 영양소→비교/관련 음식 등 독자의 다음 질문 연결. 관련 없는 순환 링크·일괄 삽입 금지.
24. 이미지 관련성·alt·라이선스·접근·대표/OG·반응형 크기·너비높이 확인. 첫 화면 대표 이미지와 아래 이미지의 로딩 우선순위를 구분.
25. PC/모바일 가독성, 가로 넘침, 확대, 표, touch/keyboard, 포커스, 대비, 목차/상단 버튼 간섭 점검. field LCP≤2.5초/INP≤200ms/CLS≤0.1(75백분위) 목표와 lab 결과를 분리. 신규 트래픽 부족은 미확정.
26. 운영 소개·출처 선정·검수·수정 원칙·문의/오류 신고 경로를 제공한다. 신고는 URL/문제 위치/설명만 최소 수집. 민감한 병력·복용정보 요청 금지. 안전 관련 신고 우선 검토. 초안 정책을 실제 게시됐다고 보고하지 않는다.

## 분석과 홍보 (27~30)

27. 이벤트: page_view(중복 방지), related_link_click, source_click, share_click, copy_link. event별 구현 위치/허용 필드/테스트 입력/DebugView 증거를 기록. 공유 click은 공유 완료가 아니다. direct는 재방문 증거가 아니다. 직원 테스트 방문 제외. PII/의료 입력/전체 URL query 전송 금지. GSC click과 GA4 session은 동일 집계가 아니다. 0/미수집/지연/접근불가 구분.
28. UTM: source=채널, medium=social/referral, campaign=health-주제-YYYYMM, content=콘텐츠 구분. 내부 링크에는 UTM을 붙이지 않는다. 공개 게시 URL·게시일·UTM·측정 기간·유입을 기록. 승인 없는 SNS/커뮤니티 메시지 발송 금지. 기록 예시를 실제 홍보로 처리하지 않는다.
29. 동일 길이의 비교 기간/수정일/기기/검색 유형/표본 기록. 노출 많고 클릭 낮은 글의 의도·제목부터 검토. 소량·익명 검색어·집계 지연으로 순위 상승을 단정하지 않는다.
30. 낮은 유입만으로 삭제하지 않는다. 독자 효용/출처/중복/링크 가치를 검토해 유지·보강·통합 후보 선정. 보호된 URL을 무단 이동하지 않는다.

## 실행과 반복 점검 (31~32)

31. 일반 Chat은 원고·기록·GitHub 결과를 담당하고 기존 러너가 제출·공개 검증을 담당. 원고 저장/CI/제출/공개 검증/색인/유입을 분리. TinyFish는 호출·연결·승인 요청 모두 금지. 기존 실행과 ledger 확인 후 실패 지점부터 복구하며 미확정 제출을 반복하지 않는다. 유료 계정/새 권한은 자동 활성화하지 않는다.
32. 주간: 오류/링크/이미지/근거 재검토 후보. 월간: 검색엔진별 성과·사이트맵 대조·도달성·수정 우선순위. 분기: 운영 정책·접근성·복구 점검. 사용자가 요청하지 않은 예약 작업은 생성하지 않는다. 수동 실행 CLI `node scripts/audit-search-foundation.mjs <새 증거 디렉터리> [최대 글 수]`; 같은 디렉터리는 checkpoint 재사용, 새 시점은 새 디렉터리. 실제 수집은 원문 HTTP이며 의미/색인 검사 아님. 500개 탐색 페이지 상한 초과는 incomplete. 비용은 기존 도구만 우선, 새 유료 기능 자동 구매 금지.

## 판정

적용 상태: 이미 충족/보강 필요/신규 적용/후순위. 별도로 구현·원격 반영·운영 검증·다음 행동 기록. 문서 추가만으로 외부 등록·콘텐츠 감수·발행·색인 완료를 만들지 않는다. 외부 접근 제한은 해당 항목만 AUTOMATION_BLOCKED. 검색 운영의 미완료는 이미 공개 검증된 글을 무효화하거나 발행을 막지 않는다.

공식 근거(확인 2026-10-10):
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://searchadvisor.naver.com/guide/site-summary
- https://www.bing.com/indexnow/getstarted
- https://support.google.com/analytics/answer/6366371
- https://web.dev/articles/defining-core-web-vitals-thresholds
