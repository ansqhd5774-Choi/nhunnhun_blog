# 수정·발행 원장 재개 점검 — 2026-10-10

기준: 최신 원격 main의 고정 커밋 `952db0ba8e45612a86da7b0b6efcdfaf5cbbd14a`. publishing/state와 publishing/update-state의 JSON 171개를 git show로 읽었다. 재제출·원장 변경·공개글 수정은 실행하지 않았다.

## 단계별 집계

|작업|phase|개수|
|---|---|---|
|publish|published|54|
|publish|submitting|1|
|publish|failed|1|
|update|submitting|20|
|update|updated|95|

## submitting·실패·미확정 원장

|원고|작업|phase|공개 상태|오류 코드|공개 URL|기록 시각|같은 URL의 이후 성공 원장|
|---|---|---|---|---|---|---|---|
|omega3-epa-dha-dose-safety-20261004|publish|submitting|없음|없음|없음|2026-10-04T13:23:33.329Z|없음|
|yuja-cheong-calories-sugar-daily-intake-storage-20261006|publish|failed|없음|E_TISTORY_DAILY_PUBLISH_LIMIT|없음|2026-10-06T13:02:00Z|없음|
|auto-179-r55-20261008-10998356|update|submitting|없음|없음|https://nhunnhun.tistory.com/179|2026-10-08T14:16:47.223Z|없음|
|auto-179-r55-20261008-13aed8ad|update|submitting|없음|없음|https://nhunnhun.tistory.com/179|2026-10-08T13:30:47.811Z|없음|
|auto-269-r55-20261008-4cad2b6c|update|submitting|없음|없음|https://nhunnhun.tistory.com/269|2026-10-08T11:09:51.121Z|없음|
|auto-323-r55-20261008-e484c1f2|update|submitting|PUBLIC_VERIFICATION_MISMATCH|없음|https://nhunnhun.tistory.com/323|2026-10-08T12:50:48.390Z|없음|
|direct-167-chicken-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/167|2026-10-08T22:06:59.124Z|direct-167-chicken-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-179-20261009|update|submitting|PUBLIC_VERIFICATION_MISMATCH|없음|https://nhunnhun.tistory.com/179|2026-10-08T16:02:27.470Z|없음|
|direct-180-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/180|2026-10-08T16:18:32.230Z|direct-180-egg-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-180-timing2-20261009|update|submitting|PUBLIC_VERIFICATION_MISMATCH|없음|https://nhunnhun.tistory.com/180|2026-10-08T17:18:17.643Z|direct-180-egg-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-180-varied-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/180|2026-10-08T16:51:31.654Z|direct-180-egg-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-239-kimchi-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/239|2026-10-08T21:20:53.992Z|direct-239-kimchi-emphasis-20261009 (updated, PUBLIC_VERIFIED)|
|direct-249-chili-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/249|2026-10-08T20:58:49.302Z|direct-249-chili-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-252-perilla-leaf-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/252|2026-10-08T21:37:13.170Z|direct-252-perilla-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-310-granola-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/310|2026-10-08T21:06:25.410Z|direct-310-granola-emphasis-20261009 (updated, PUBLIC_VERIFIED)|
|direct-333-peanut-butter-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/333|2026-10-08T22:29:03.568Z|direct-333-peanut-butter-emphasis-20261009 (updated, PUBLIC_VERIFIED)|
|direct-39-chewing-gum-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/39|2026-10-08T21:51:52.844Z|direct-39-gum-emphasis-20261009 (updated, PUBLIC_VERIFIED)|
|direct-65-mackerel-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/65|2026-10-08T20:28:07.521Z|direct-65-mackerel-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|direct-65-mackerel-links-20261009|update|submitting|없음|없음|https://nhunnhun.tistory.com/65|2026-10-08T20:44:42.465Z|direct-65-mackerel-emphasis-20261010 (updated, PUBLIC_VERIFIED)|
|image-refresh-269-20261008|update|submitting|없음|없음|https://nhunnhun.tistory.com/269|2026-10-08T11:51:07.792Z|없음|
|image-visual-269-20261008|update|submitting|없음|없음|https://nhunnhun.tistory.com/269|2026-10-08T12:11:51.245Z|없음|
|remove-credit-sections-269-20261008|update|submitting|PUBLIC_VERIFICATION_MISMATCH|없음|https://nhunnhun.tistory.com/269|2026-10-08T12:19:11.397Z|없음|

## 판정 범위

- 미확정 기록 22개 중 같은 URL에 더 최근 성공 phase가 있는 기록 12개. 이는 과거 미완료 원장의 후속 성공 증거이며, 같은 fingerprint의 검증 완료로 자동 전환하지 않는다.
- 원장 phase가 published/updated이나 구조화된 PUBLIC_VERIFIED 항목이 없는 과거 기록: 89개. 과거 성공 증거를 무효화하지 않는다. 이 집계만으로 실제 발행 실패 또는 재제출 필요로 판정하지 않는다.
- 원장이 없는 실패 실행은 이 집계로 발견되지 않는다. Actions 실행 전체와 원장 전체를 동일한 모집단으로 간주하지 않는다.
- 공개 URL의 현재 본문·사진과 원고 fingerprint 비교는 이번 읽기 전용 집계에서 실행하지 않았다.
- 미확정 원장은 관리자 및 공개 본문 대조가 선행되어야 하며, 원장 phase만으로 재제출하지 않는다.

## /179·/269·/323 현재 공개 HTML 교차 확인

조회시각: 2026-10-09T23:41:47.021Z. 재제출·원장 변경 없음. 기존 inspectHtml·assertPublicTitle·updateFingerprint·renderEditorialPost 모듈을 재사용했다. 브라우저 연결이 제공되지 않아 rawHTML 교차 점검이며 실제 innerText·computedStyle·이미지 로딩·PC모바일 공개 검증의 PASS를 대신하지 않는다.

|URL|최신 source ID|제목|원장과 현재원고 동일 여부|원장 실패 코드|HTML root/direct root|이미지 기대/관찰|mark 기대/관찰|문단앵커일치|실제 전체본문|
|---|---|---|---|---|---|---|---|---|---|
|https://nhunnhun.tistory.com/179|direct-179-20261009|PASS|같음|E_QA_ROOT|1/0|1/1|6/6|6/6|확인 불가|
|https://nhunnhun.tistory.com/269|remove-credit-sections-269-20261008|PASS|같음|E_QA_BODY|1/0|1/1|0/0|8/8|확인 불가|
|https://nhunnhun.tistory.com/323|auto-323-r55-20261008-e484c1f2|PASS|같음|E_QA_BODY|1/0|1/1|0/0|8/8|확인 불가|

## 실제 브라우저 DOM 수집 후 원인 확정

메인 작업자가 공식 브라우저에서 읽기 전용으로 수집한 `ledger-current-dom.json`을 추가 대조했다. 실제 `.contents_style`의 innerText·innerHTML·h1/OG·이미지·mark·direct wrapper 정보를 사용했다. 아래는 제목·본문 구조 차이의 진단이며 이미지 픽셀 로딩·대표 이미지 해시·모바일 computed style까지의 전체 공개 검증 PASS가 아니다.

|URL|부분 검증|확정된 차이|전체 공개 QA|
|---|---|---|---|
|/179|제목 PASS, 이미지 개수1/1, mark6/6, 원고 문단6/6 관찰|실제 `.nh-direct`와 현재 렌더러의 `.nh-direct-v2`가 다름. 실제 본문에서 스킨 TOC와 H2 표시번호만 제거하면 현재 원고 본문 텍스트2167자가 전부 일치한다. 원고 미반영이나 본문 유실로 단정할 증거가 없다.|FAIL: 현재 기대 wrapper/렌더 계약과의 불일치. 과거 출력과 최신 렌더 구분 필요|
|/269|제목 PASS, 이미지 개수1/1, mark0/0, 문단8/8 관찰|실제 H2의 `1. `~`6. ` 접두번호가 제거됨. 기대 HTML의 H2 접두번호6개만 제거하면 전체 텍스트3675자가 전부 일치한다.|전체 미확인. 과거 E_QA_BODY 원인은 번호 장식 차이|
|/323|제목 PASS, 이미지 개수1/1, mark0/0, 문단8/8 관찰|같은 H2 접두번호6개 차이만 존재. 번호를 제외하면 전체 텍스트4412자가 전부 일치한다.|전체 미확인. 과거 E_QA_BODY 원인은 번호 장식 차이|

`/269`와 `/323`의 E_QA_BODY는 본문 내용 변경이 아닌 스킨 H2 번호 정리와 검증기의 기대 innerText 생성 차이로 확인됐다. 이것을 공개 본문 미반영으로 보고 재제출하면 안 된다. `/179`는 같은 예외로 wrapper를 무조건 허용하지 않는다.

### 최소 검증기 수정 준비

`publishing/public-body.mjs`의 비교기는 기존 전체 텍스트 일치를 우선한다. 불일치할 때만 실제/기대 H2 개수·순서·제목 의미가 같고 각 제목이 독립된 유일한 줄일 경우 H2 앞 1~2자리 번호와 마침표 장식만 제외한다. 문단의 수치, 본문 누락, 제목 변경, 순서 차이, 중복 줄, 소수점 수치 제목은 실패를 유지한다. 실제 링크·이미지·강조와 제목 검증은 변경하지 않는다.

`verify-updated-public.mjs`의 E_QA_BODY 비교만 이 함수를 사용하도록 변경했다. root 선택자나 `/179` wrapper 계약은 변경하지 않았다. 회귀검사: 새 본문 테스트10개 + 기존 공개 제목 테스트5개, 총15 PASS. 모듈 문법 검사와 diff whitespace PASS. 코드 커밋·러너 배포·실제 재검증은 메인 작업자가 기존 수정 실행 종료 후 별도 PR로 진행한다.

### direct-179-20261009
- HTTP 200; 원장 제출 sourceCommit: 7d7e470d3da51f51d7e2a3bba89705b0f61eea84; 로컬 렌더 계약: PASS.
- 실제 DOM의 root 개수·innerText를 측정하지 않았으므로 정적 태그 차이를 E_QA_BODY 전체 실패로 단정하지 않는다.

### remove-credit-sections-269-20261008
- HTTP 200; 원장 제출 sourceCommit: 129bdb26591e35c993878b7b5950b064fc00b4c2; 로컬 렌더 계약: PASS.
- 실제 DOM의 root 개수·innerText를 측정하지 않았으므로 정적 태그 차이를 E_QA_BODY 전체 실패로 단정하지 않는다.

### auto-323-r55-20261008-e484c1f2
- HTTP 200; 원장 제출 sourceCommit: b75c5dd43406b1c1ca17ffd15b2ea467d6beaac8; 로컬 렌더 계약: PASS.
- 실제 DOM의 root 개수·innerText를 측정하지 않았으므로 정적 태그 차이를 E_QA_BODY 전체 실패로 단정하지 않는다.
