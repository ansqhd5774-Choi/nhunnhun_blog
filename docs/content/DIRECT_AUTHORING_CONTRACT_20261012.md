# direct/SP1 작성·저장·제출 기술 계약 — 2026-10-15

적용 범위는 `nhunnhun_blog`의 신규 및 전체 수정 `direct-* / SP1` 경로다.

음식 원고의 **내용·검색 의도·소제목·문체·정보 범위·본문 균형**은 아래 두 문서만 결정한다.
- `docs/project-instructions/PROJECT_INSTRUCTIONS_FOOD_R8.1.txt`
- `docs/content/FOOD_CONTENT_QUALITY_R1.md`

이 문서는 **렌더링·강조 구조·이미지 메타데이터·저장·제출·공개 검증의 기술 계약만** 정한다. 음식 편집 질문이나 본문 내용을 추가하지 않는다.

## 음식 편집 범위 잠금
- 다른 저장소·다른 카테고리·legacy 공통 문서의 소제목·문체·편집 질문을 음식 원고에 사용하지 않는다.
- 음식 source의 작성 준비 결과는 `scope=FOOD_ONLY`를 유지한다.
- 음식 `editorialReview`는 음식 전용 기준만 참조한다.
- 음식 원고 작성·수정은 direct/SP1 경로만 사용한다. Queue/Ollama 작성 경로는 사용하지 않는다.
- 공통 코드·테스트에 다른 카테고리 예시가 있어도 음식 편집 기준으로 승격하지 않는다.

## 단일 규격과 구조 검사
`publishing/direct-authoring-contract.mjs`가 이미지 허용 키·최소 수·강조 최소 수·핵심 H2 상한을 제공한다. `publishing/direct-preflight.mjs`가 제출 전 구조 검사를 실행한다.

- 음식 핵심 H2 최대 6개. FAQ·핵심 정리·자료 출처 등 보조 항목은 제외한다.
- 음식의 실제 H2 이름·순서·의미는 음식 전용 프로젝트 지침을 따른다.
- `contentStandard=SP1`을 유지한다.
- PREFLIGHT_PASS는 구조 검사 결과이며 콘텐츠 품질이나 의미 적합성 인증이 아니다.
- `foodAxisReview`와 `editorialReview`는 작성자가 확인할 관찰 자료이며 `automatedSemanticVerdict=false`를 유지한다.
- 새 AI 의미 판정·자동 PASS·자동 재작성 루프를 만들지 않는다.

## 강조 기술 계약
- 음식 direct/SP1 강조 하한: **strong25·mark12·mark>u>strong8**.
- 강조는 기존 3단계 구조를 사용한다.
  1. `<strong>`
  2. `<mark data-tone="..."><strong>`
  3. `<mark data-tone="..."><u><strong>`
- 허용 tone은 기존 direct 강조 계약을 따른다.
- 강조 하한을 채우기 위해 새로운 사실·수치·문장을 생성하지 않는다.
- 독자에게 필요한 핵심 답과 실제 행동 정보를 우선 강조한다.
- 일반적인 제한·반박 문장을 강조 개수 충족용으로 승격하지 않는다.
- 실제 금기·응급 행동은 안전상 필요한 수준으로 강조할 수 있다.

## 이미지 기술 계약
- 신규 및 음식 direct/SP1 전체 수정은 서로 다른 관련 본문 이미지 최소 3개를 준비한다.
- 대표 이미지·본문 이미지의 src/alt와 원출처·촬영자 또는 제공 주체·이용 근거를 기록한다. 실제 제품 식별이나 질환 설명에 필요한 관련 사진을 우선한다.
- 대표사진은 `closeup`만 강제하지 않는다. 실제 대상과 일치하면 `serving`·`context`·`field` 등도 가능하며, 대표 이미지 URL과 출처 검증은 유지한다.
- `imageReview` 허용 키: `src, alt, role, composition, sourcePage, author, license, usageBasis, visualChecked`.
- 기존 CC/퍼블릭도메인/GFDL 사진은 `license`만으로 통과한다. 이를 모든 이미지의 필수 자격으로 강제하지 않는다.
- 명시적 자유이용 라이선스가 없는 사진은 `usageBasis`를 기록한다: `original`(직접 촬영), `authorized`(이용 허락), `product-identification`(제품 외형 식별), `quotation`(설명·비평·교육 목적의 정당한 인용).
- `license`가 확인되지 않았다면 임의로 CC 라이선스를 붙이지 않는다. `usageBasis`는 작성자의 검토 기록이며 자동으로 저작권 적법성을 보증하지 않는다. 명시적인 재사용 금지나 창작성 있는 광고·연출 사진은 별도 판단한다.
- 구체적 제품·의약품 사진은 상자와 성분·함량·제조사 등이 본문과 일치하는지 확인한다. 사진이 필요한 설명을 외부 링크만으로 대체하지 않는다.
- `visualChecked`는 선택적 boolean 관찰 기록이며 실제 확인한 경우에만 true로 기록한다.
- `visualChecked` 누락이나 false만으로 제출을 막지 않는다.
- 기존 원고·archive 이미지를 재사용할 때 자산·귀속 정보는 재사용할 수 있지만 `visualChecked`는 자동 승계하지 않는다.
- `imageReview.sourcePage`는 본문 자료 출처에도 같은 HTTPS 링크로 연결한다.

## 저장 전 기술 확인
- sourceId·articleId·targetUrl·expectedCurrentTitle 등 대상 식별값이 올바른가.
- 신규/기존 target-resolution 결과와 source operation이 일치하는가.
- `contentStandard=SP1`인가.
- 사용자 확정 6개 핵심 H2를 초과하지 않는가.
- 강조 구조와 최소 수가 기술 계약을 충족하는가.
- 이미지 수·중복·HTTPS·alt·귀속 메타데이터가 유효한가.
- 내부링크와 외부 출처 링크가 허용된 형식인가.
- 제출 전 source digest가 Gate 0과 GitHub 저장본에서 일치하는가.

## Gate 0
1. 완성 원고 JSON 전체를 자동 발행 경로 밖에 보존한다.
2. sourceId·articleId·title·전체 source digest·검사 결과·저장/실행 상태를 함께 남긴다.
3. 신규 음식이면 target-resolution 요청과 판정 결과도 함께 보존한다.
4. GitHub 저장 후 실제 커밋 SHA에 고정한 source를 다시 읽어 digest 일치를 확인한다.
5. 실제 제출이 시작된 뒤에는 해당 source와 실행 코드를 임의 변경하지 않는다.

## 신규 발행
- `target-resolution request → resolve-target.yml → result=new → Gate 0 → posts/*.json → publish-posts.yml`
- 신규 mutation 직전 대상 재확인 Gate를 통과해야 한다.
- 기존 후보가 발견되면 신규 발행을 중단하고 기존 숫자 URL 수정 경로로 전환한다.

## 기존 글 수정
- 기존 숫자 URL을 유지한다.
- `updates/direct-*.json → direct-author-update.yml → update-posts.yml` 경로를 사용한다.
- expected title/source drift 보호를 유지한다.

## 제출·공개 검증
- HTTP 200·SUBMIT_CLICKED·Actions SUCCESS만으로 완료라고 하지 않는다.
- 신규는 `phase=published + PUBLIC_VERIFIED`, 기존 수정은 `phase=updated + PUBLIC_VERIFIED`를 확인한다.
- PUBLIC_VERIFIED는 공개 반영·렌더 검증이며 콘텐츠 의미 인증이 아니다.
- 제출 후 결과가 불명확하면 중복 재제출하지 않고 읽기 전용 복구 절차를 사용한다.

## 완료 보고
- 작업 대상
- 최종 source SHA
- Run 번호 또는 링크
- 공개 URL
- 원장 상태
- PUBLIC_VERIFIED 여부
- 중요한 오류가 있으면 직접 원인

저장·제출·검증과 무관한 음식 편집 기준은 이 기술 계약에 추가하지 않는다.
