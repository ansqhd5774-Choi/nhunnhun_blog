# 검색·운영 개선 후속 적용 기록

대상: 한입 건강 https://nhunnhun.tistory.com/.
시작 source: `76979704b2e3bd1cba5c29032ac1b1faa4ecc859`.
전체 상태는 [32개 항목 현황](HEALTH_GROWTH_STATUS_20261010.md)에서 관리한다.

## 실제 반영

- Bing: 실제 관리자 스킨은 `<head>` 시작 전에 스타일·메타·스크립트를 배치하고 있었다. 새 ZIP 백업과 편집기 내용 일치를 확인하고 head 시작 및 기존 소유확인 태그 위치만 보정했다. 변경 후 공식 Bing 화면에서 소유 확인이 성공했다. 따라서 이전 provider 불일치는 해결됐으며, 다른 검색 오류의 원인까지 이 구조로 단정하지 않는다. 사이트맵은 재제출 후 `Processing`; 색인 완료는 미확인.
- 운영 안내: `https://nhunnhun.tistory.com/pages/about` 공개. 자료 선정, 작성·검토, 날짜·수정, 이미지·광고, 오류 신고를 안내한다. 사용자 지정 이메일 `ansqhd5774@gmail.com`을 실제 공개했으며 외부 이메일은 발송하지 않았다. 정책의 기술 검사 설명은 독립 전문 감수와 구분한다.
- 탐색: 기존 음식·영양소·약학·질병 카테고리에 소개와 추천 글 링크를 추가했다. URL·분류·기존 본문을 보존하고 스킨 하단에 운영 안내 링크를 추가했다. 카테고리 안내는 클라이언트 렌더이며 검색봇 수집 증거로 간주하지 않는다.
- 소개: 티스토리 블로그 설명을 실제 운영 범위인 음식·영양소·약학·질병으로 수정·저장했다. 이전 프로필 이미지는 발견했으나 파일 업로드 제한으로 교체하지 못했다.
- 홍보: 사용자 답변에 따라 홍보 채널 없음으로 보류. 오류 신고 이메일 공개는 홍보 발송 승인이 아니다.

## 확인 결과와 한계

- 독립 관리자 공개 목록: 24페이지, 숫자글354개. 관리자 수집 시점 `2026-10-09T17:42:24.318Z`, 사이트맵 비교 `2026-10-09T17:43:52.565Z`. 양쪽354개 일치, 누락·관리자 부재 URL·중복0. 이후 다른 작업자가 발행한 글은 이 스냅샷에 포함되지 않는다.
- 같은 목록354개 새 raw HTTP 검사: HTTP 오류0, noindex0, 서로 다른 canonical URL 충돌0, title 중복0, description 중복0·누락0, JSON-LD 파싱 오류0.
- 본문 안 중첩 canonical184개는 별도 분류했다. 동일 canonical의 중첩을 URL 충돌 또는 색인 실패로 보고하지 않는다. 과거 본문 정리·전체 제목/본문 의미 검토·schema 의미 검토는 미수행이다.
- head 변경 후 공개 글 PC1440/모바일390 가로 넘침0을 확인했다. 4개 카테고리의 안내·링크·넘침을 실제 확인했다. 이 검사는 전체 접근성·Core Web Vitals·검색봇 검증을 대신하지 않는다.
- 로컬 전체 회귀 검사286개 PASS. 새 진단 검사는 독립 목록 차이·중복, head 보정 보존/모호성 거절, 중첩 canonical 분류, 탐색 설치 중복 거절을 확인한다.

## 실행 방법

모든 명령은 읽기 전용 진단 또는 로컬 후보 생성이다. 티스토리 발행 게이트에 연결하지 않는다. 독립 목록 입력은 공식 관리자에서 수집한 공개 숫자글 목록이며, sitemap에서 역으로 만들지 않는다.

```text
node scripts/compare-public-inventory.mjs <admin-public.json> <comparison.json>
node scripts/audit-public-metadata.mjs <admin-public.json> <새 증거 디렉터리>
node scripts/normalize-skin-head.mjs <새 관리자 백업 skin.html> <로컬 후보.html>
node scripts/install-growth-navigation.mjs <현재 관리자 백업 skin.html> <로컬 후보.html>
```

목록 입력: `{ "checkedAt": "실제 확인 ISO 시각", "pages": 24, "rows": [{ "url": "https://nhunnhun.tistory.com/282" }] }`.
메타 검사에서 같은 디렉터리는 checkpoint를 재사용한다. 새로운 시점이나 스킨 변경 후 재검사는 새 디렉터리를 사용한다. 예제 숫자는 현재 전체 글 수로 재사용하지 않는다.

후보 생성 후에는 새 백업과 현재 편집기의 일치, 후보 diff, 실제 적용 및 공개 화면을 각각 확인한다. `skin/reference`의 REDACTED 사본이나 공개 렌더 HTML을 배포 원본으로 사용하지 않는다. 설치 스크립트는 중복 적용을 거절한다.

## 증거와 복구

실제 전체 스킨 및 ZIP·SHA256 manifest는 작업 루트의 private `backup/20261010-bing-head`, `backup/20261010-growth-navigation`에 보관했다. 저장소에는 인증·광고 식별자를 포함한 전체 스킨을 커밋하지 않는다.

작업 루트 `evidence/search-foundation-20261010/`:
`admin-public.json`, `inventory-comparison.json`, `metadata-pages.json`, `metadata-summary.json`, `head-fix-pc.png`, `head-fix-mobile.png`, `bing-sitemap.png`, `editorial-policy.png`, `editorial-contact.png`, `category-results.json`.

프로필 업로드는 IAB 및 Chrome에서 파일 선택 이벤트를 얻지 못했다. 업로드·삭제는 미실행, 기존 이미지를 유지했다. 이는 AUTOMATION_BLOCKED이며 공개 사이트 기능 실패가 아니다. 동일 호출을 계속 반복하거나 보안 권한을 임의 변경하지 않는다. 공식 해결 안내: https://developers.openai.com/codex/app/chrome-extension#upload-files .

IndexNow 원래 호스트 키 파일 경로, URL별 색인·원문 날짜·이미지 라이선스 전체 감수·실제 분석 수집 검증은 남아 있다. 이 항목으로 표준 글 발행을 중단하지 않는다.
