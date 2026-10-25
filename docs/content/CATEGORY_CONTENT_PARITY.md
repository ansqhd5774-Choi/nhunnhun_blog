# 음식 전용 공통 디자인·발행 기술 계약 — 2026-10-12

이 문서는 `nhunnhun_blog` 음식 원고가 공유하는 **기술 규칙만** 정한다. 음식의 실제 내용·검색 의도·소제목·효능·궁합·문체는 `docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt`만 기준으로 한다. 다른 카테고리의 질문·소제목·편집 예시는 이 문서에 두지 않는다.

## 디자인·강조

- 승인된 direct-design 렌더러, CSS, 목차, 번호, 표, 카드, 대표 이미지, PC/모바일 배치를 그대로 사용한다.
- 강조는 1단계 `<strong>`, 2단계 `<mark><strong>`, 3단계 `<mark><u><strong>`를 사용한다.
- direct/SP1 누락 방지 하한은 `strong` 18개, `mark` 8개, `mark > u > strong` 2개다.
- 하한을 채우기 위해 사실·효능·경고를 새로 만들거나 문단 전체를 자동 강조하지 않는다.
- 일반적인 근거 한계 문장은 핵심 강조 대상으로 사용하지 않는다. 실제 알레르기·독성·금기·응급 행동 등 중요한 안전정보는 필요한 강도로 강조할 수 있다.

## 이미지

- 신규 및 direct/SP1 전체 수정은 서로 다른 본문 이미지 최소 3개를 준비한다.
- HTTPS, alt, 실제 대상의 정확성, 대표 이미지, 원출처, 제공자/저작자, 이용 상태, 출처 연결, 동일 이미지 중복을 확인한다.
- CC 라이선스나 단일 대표 사진 구도를 필수로 요구하지 않는다. 공식 포장·원물·질병 특징 등을 정확히 식별할 수 있는 사진이 정보 가치가 높으며, 단순 식별 사진과 독창적인 광고·연출 사진을 구분한다.
- `license`는 출처에서 확인 가능한 라이선스 또는 권리·이용 상태의 사실 기록이다. 자동 통과가 사용 허가를 보증하지 않으며, 명시적인 재사용 금지 등 구체적인 이슈가 있으면 개별 검토한다.
- 서로 다른 사진은 원출처 페이지가 같아도 사용 가능하다. 같은 이미지 URL 중복은 금지한다.
- `imageReview` 허용 키는 `src`, `alt`, `role`, `composition`, `sourcePage`, `author`, `license`, 선택적 boolean `visualChecked`다.
- `visualChecked`는 실제로 현재 source/revision에서 이미지를 확인한 경우에만 true로 기록한다. 누락 또는 false는 제출 차단 사유가 아니다.
- 실제 확인 없이 visualChecked를 자동 생성하거나 과거 source의 값을 승계하지 않는다.

## 구조

- 음식 핵심 H2는 음식 프로젝트 지침의 6개 축을 기준으로 최대 6개다.
- FAQ·핵심 정리·자료 출처는 보조 항목으로 둘 수 있다.
- 핵심 H2의 의미 충족 여부는 자동 구조 검사로 인증하지 않는다. 저장 전 작성자가 `음식 축 → 독자의 실제 질문 → H2 → 첫 문장 답변`을 직접 대조한다.
- 다른 분야의 소제목 체계·목차·예시를 음식 원고에 적용하지 않는다.

## direct/SP1 기술 검사

- `publishing/direct-authoring-contract.mjs`와 `publishing/direct-preflight.mjs`를 공통 사용한다.
- 기존 강조·이미지·본문 집중 검사를 유지한다.
- `PREFLIGHT_PASS`는 구조 검사 결과이며 의학적 진실, 문체 품질, 사진의 시각적 적합성, 소제목 의미 적합성을 인증하지 않는다.
- 새 AI 의미 판정, 자동 재작성 루프, 분야별 CI를 추가하지 않는다.

## 발행 경로

- 신규: `posts/*.json` → `.github/workflows/publish-posts.yml`
- 기존 수정: `updates/direct-*.json` → `.github/workflows/direct-author-update.yml` → `.github/workflows/update-posts.yml`
- direct source는 `contentStandard=SP1`을 유지한다.
- 동일한 공통 mutation 잠금, 제출 보호, 공개 검증, 원장을 사용한다.
- 자동 실행이 시작됐으면 수동 실행을 겹치지 않는다.
- 실제 제출 시작 후 최종 상태가 확인될 때까지 해당 source와 실행 코드를 바꾸지 않는다.

## 공개 검증

- HTTP200, 제출 클릭, Actions SUCCESS만으로 완료라고 하지 않는다.
- 해당 source의 `PUBLIC_VERIFIED`와 신규 `published` 또는 기존 `updated` 원장을 확인한다.
- 러너가 제목·본문·이미지·대표 이미지·강조·PC1440·모바일390 렌더를 확인한다.
- `PUBLIC_VERIFIED`는 공개 반영·렌더 검증이며 의학적 또는 편집 의미 인증이 아니다.

## 보존

- 변경 없는 과거 원장과 공개 복구 상태는 운영 복구 근거이므로 유지한다.
- 이 기술 계약을 이유로 과거 공개 글을 자동 재작성하거나 재발행하지 않는다.
- 음식 편집 판단에는 음식 전용 프로젝트 지침 외의 카테고리별 기준을 사용하지 않는다.
