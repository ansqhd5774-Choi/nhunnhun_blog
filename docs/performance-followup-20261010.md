# 모바일 성능·접근성 후속 관찰

## 실제 수행

2026-10-10 공개 `/282`, `/264`, `/237` 원시 HTTP 자원 분석을 수행했다. 본문 이미지 각 3장, 첫 사진 `loading=eager`, `fetchpriority=high`, preconnect 5개(중복 0개)를 확인했다. 폭·높이 HTML 속성 미제공을 경고로 기록하지만 CSS의 실제 크기 예약이나 CLS 원인까지 확정하지 않는다.

전용 `scripts/performance-resource-audit.mjs`는 최대 10개 글만 읽고 원고·스킨·광고·원장을 변경하지 않는다. 원시 HTML 및 비동기 stylesheet를 구분하며, 결과에서 자원 주소의 쿼리 값을 제거한다. 후보 사진을 실제 LCP로 표시하거나 HTTP 200을 성능 PASS로 해석하지 않는다. 전용 검사 4/4 PASS.

## 공식 보고서 재확인과 새 측정

기존 05:14 모바일 측정은 성능 57, 접근성 97, LCP 10.6초, CLS 0.069였다. 상세 화면의 LCP는 첫 사진이 아닌 최초 발행·개정 날짜 `.sub-info`였고, 본문 전체 이동 0.069가 표시됐다. 대비 오류는 네이버 광고 주소, SEO 링크 오류는 플랫폼 댓글 작성자의 href 없는 링크였다.

[새 모바일 단일 측정](https://pagespeed.web.dev/analysis/https-nhunnhun-tistory-com-282/iipd2bxx6x?form_factor=mobile), 08:24:09 KST:

|항목|결과|
|---|---|
|성능|41|
|접근성|100|
|권장사항|100|
|SEO|92|
|FCP|5.7초|
|LCP|9.0초|
|TBT|150밀리초|
|CLS|0.395|
|실제 사용자 데이터|없음|

이번 LCP는 본문 문단으로 달라졌다. CLS는 본문 전체 이동 0.322와 0.070, 제목 0.002가 표시됐고, 첫 이동에는 외부 웹 글꼴이 함께 지목됐다. 광고·네트워크 변동이 있어 단일 점수 차이를 코드 개선·퇴보로 단정하지 않는다.

실제 공개 DOM에서 제목·날짜·본문은 system-ui 계열, Material Icons는 기존 `onload` 비동기 로드가 적용됐음을 확인했다. 따라서 아이콘 비동기 패치를 중복 설치하지 않았다. 렌더링 차단 목록 대부분은 티스토리 플랫폼의 jQuery·base·Kakao·Tiara 및 플랫폼 CSS다. 광고가 추가한 Roboto stylesheet도 확인했다. 이들을 삭제하거나 강제로 async 처리하면 플랫폼·광고 동작을 바꿀 수 있어 적용하지 않았다.

## 최종 판정

- 진단 도구 구현 및 독립 검사: PASS.
- 대표 페이지 최신 성능 목표: FAIL (LCP·CLS 미달). 단일 실험실 측정이며 전체 사이트 또는 사용자 체감 실패 판정은 아니다.
- 이번 측정의 자동 접근성: PASS 100. 이전 네이버 광고 대비 오류는 광고 내용에 따라 재발할 수 있고, 전체 수동 접근성 완료를 의미하지 않는다.
- 실제 사용자 CWV: 확인 불가 (데이터 없음).
- 운영 변경: 없음. 디자인·광고·본문·스킨 보존. 임의 고정 높이, 광고 삭제, 이미 적용된 폰트 패치 재설치는 수행하지 않았다.

로컬 세부 관찰과 캡처는 `evidence/health-growth-final-20261010/performance-psi-current.txt`, `performance-psi-current.png`, `performance-resource-final.json`에 보존한다. 후속 개선은 지목된 이동의 상위 삽입 요소와 발생 순서까지 실제 트레이스로 확인한 뒤 결정한다. 해당 관찰을 완료 조건에서 제외하거나 점수 향상으로 보고하지 않는다.

## 공식 Chrome 트레이스 추가 조사

공식 브라우저 CDP capability로 전용 공개 탭만 390×844 모바일 에뮬레이션 후 초기 로드 트레이스를 수집했다. 48,282개 이벤트를 수집했으며 종료 이벤트와 비잘림을 확인했다. 로그 보존 후 모바일 override를 원복하고 전용 탭을 닫았다. 사용자 Chrome의 따뜻한 캐시 및 입력 직후 관찰이므로 Lighthouse·실제 사용자 CWV와 동일한 수치로 해석하지 않는다.

가장 큰 이동 이벤트 0.317(최대 거리 443.9375px)은 `nh-reader-tools` 목차를 본문 앞에 삽입하면서 본문 문단이 화면 밖으로 이동하는 시점이었다. 이 관찰에서는 recent input 표시로 누적 CLS에서 제외됐다. 후속 날짜·제목 영역의 30.140625px 이동은 0.02137로 기록됐다. 본문 첫 이동을 모두 광고 문제로 설명하는 것은 부정확하다.

현재 스킨의 `nh-reader-tools-script`는 티스토리 본문·하단 post_button_group 뒤에 실행되고, 긴 제목을 목차에 넣은 뒤 `nh-reading-layout-20261009`가 제목을 다시 짧게 만든다. 알려진 최종 짧은 목차 문구를 생성 시점부터 사용하고 full title·title 속성을 유지하는 최소 후보 `scripts/performance-toc-candidate.mjs`를 준비했다. 기존 화면의 최종 문구·목차 항목·링크·광고·사진은 유지한다. 후보는 원본을 덮어쓰거나 자동 배포하지 않고, REDACTED·알 수 없는 원본 계약을 거부한다. 독립 검사는 5/5 PASS다.

이 후보는 목차 문자열의 후속 재배치를 줄이는 범위이며, 늦은 목차 삽입 자체의 큰 이동을 제거했다고 보고하지 않는다. 실제 배포·변경 후 측정은 별도 확인 대상이다. 목차의 임의 고정 높이나 본문 숨김으로 점수를 맞추지 않는다.

## 08:32 실제 적용 후 재검증

메인 Codex가 관리자 원본 일치 확인 후 compact TOC 후보를 공식 UI로 적용했다. 공개 `/282`에서 `data-full-title` 및 짧은 목차 9개와 기존 대상 ID 보존을 확인했다. 모바일 390px와 PC 1440px 모두 가로 넘침 0px다. 모바일 목차 클릭은 이동을 확인하지 못했다: 클릭 후 안정 상태에서도 scrollY 0이고 대상 제목은 화면 아래에 있었다. 따라서 이동 기능은 PASS가 아니다.

적용 후 PSI: https://pagespeed.web.dev/analysis/https-nhunnhun-tistory-com-282/u41a22w58f?form_factor=mobile

2026-10-10 08:32:34 KST: 성능 42, 접근성 97, 권장사항 96, SEO 92. FCP 5.8s, LCP 7.4s, TBT 20ms, CLS 0.411, SI 6.2s. 실제 사용자 field 데이터 없음. 이전 08:24 CLS 0.395와 비교해 개선은 입증되지 않았다. 단일 실행의 LCP 차이를 패치 효과로 단정하지 않는다.

공식 CDP trace 완료(57,620 events). 초기 본문 이동 443.94px, shift score 0.316976은 이전과 동일하다. warm-cache GUI trace의 recent-input 제외 때문에 cumulative 0.043156이며 PSI와 동일 산식 비교로 쓰지 않는다. PSI 상세의 주요 본문 이동은 0.317, 0.070, 0.022다. 라벨 축약은 늦은 목차 삽입 자체를 해결하지 않았다.

현행 script는 서버 article HTML 바로 다음에서 동기 init한다. 더 앞당기면 H2 파싱 전이므로 제목 목록을 알 수 없다. 임의 높이와 본문 숨김을 쓰지 않는 근본안은 서버 렌더링 정적 목차를 원고에 넣어 재사용하는 계약 또는 본문 목차를 떠 있는 UI로 변경하는 것이다. 전자는 기존 원고 변경, 후자는 디자인 변경이므로 현재 최소 스킨 변경 범위와 구분해야 한다.

증거: 외부 private evidence 폴더의 performance-trace-after.json, performance-psi-after.txt, performance-psi-after-details.txt, performance-after-mobile.png, performance-after-desktop.png. 브라우저 검사 탭과 temporary viewport는 정리했다.

## 목차 이동 보정 후보 검사

모바일에서 details를 먼저 닫고 requestAnimationFrame에서 대상 heading 이동을 실행하도록 별도 후보를 작성했다. PC 즉시 이동, prefers-reduced-motion의 auto 동작, 기존 스킨 보존, 원본 불일치 차단을 검증하는 `tests/performance-toc-scroll-candidate.test.mjs` 5개 PASS. 메인 Codex가 관리자 저장을 확인했지만 공개 캐시 전파는 아직 확인하지 못했다. 반복 저장하지 않으며 공개 반영 후 이동 기능을 다시 확인한다.
