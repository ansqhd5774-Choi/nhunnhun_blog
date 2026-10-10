# 이미지 alt 전용 유지보수 계약 설계와 구현 범위

기준 origin/main: b763abcf440aeb5e4c84eba68e3cd85c4c2865a9. 대상은 기존 숫자 URL의 지정 이미지 alt만 변경하는 작업이다. 새 건강정보 원고 감수 또는 R1/SP1 콘텐츠 PASS를 선언하지 않는다.

## 현재 경로를 그대로 쓰면 보존하지 못하는 항목

`update.mjs`는 현재 editor body를 읽은 뒤 `renderEditorialPost(update)`를 적용하고 모든 이미지와 대표 이미지를 다시 업로드한다. 기존 body를 alt만 바꾸어 그대로 저장하는 경로가 아니다. `finalize-update.mjs`도 Editorial 렌더 결과를 기대값으로 사용한다. `update-core.mjs`는 ready/approved 전체 원고를 요구한다. `isPublishedProductLinkRepair` 예외는 posts 원고, published ledger, 기존 fingerprint 일치가 필요하며 이번 legacy 6개 글은 posts/updates JSON이 없어 그 예외의 보호 근거를 충족하지 않는다.

## 구현한 순수 계약

`publishing/alt-maintenance-contract.mjs`: operation=image-alt-only-v1, articleId, expectedTitle, expectedBodySha256, expectedMetadataSha256, patches만 허용한다. 한 요청은 1~10 이미지로 한정한다. 각 patch는 0-based imageIndex, exact raw src의 SHA256, expectedAltRaw(null은 속성 없음), newAlt를 요구한다.

`applyAltMaintenance`는 실제 현재 editor HTML 해시와 전체 metadata 해시를 먼저 대조한다. metadata는 title/category/tags/representativeImage/visibility 5개 항목 전부 필요하며 누락값을 자동 추정하지 않는다. 태그 순서와 대표 이미지까지 그대로 유지하는 규약이다. img raw tag에서 지정 alt 속성의 바이트만 변경한다. src/기타 속성/본문은 그대로 보존한다. 따옴표·특수문자는 escape하며 중복 src/alt, unquoted 속성, 중복 index, 본문·메타·src·기존 alt 불일치를 차단한다. 반복 적용은 원본문 해시 불일치로 차단한다.

반환값 publicationEnabled=false는 의도적이다. 이 순수 모듈은 기존 발행 권한·원장·뮤텍스 경로를 새로 만들거나 우회하지 않으며 네트워크·editor·최종 제출을 실행하지 않는다. semanticVerification=alt-visual-review-only는 기존 전체 콘텐츠 재감수를 의미하지 않는다.

## 실제 runner 통합에 필요한 최소 순서

1. 기존 update-posts workflow 및 runner gate/source drift/mutex를 유지한다. operation만 분기하여 R1 또는 SP1을 가장하지 않는다. 선택 한 건 제한과 이미지·본문 HTML 보안 검사를 유지한다.
2. 관리자 기존 editor에서 현재 title/body/category/tags/visibility/representative를 실제 읽어 원본 snapshot을 확보한다. 서버·UI 값과 동일하게 canonical capture하는 selector/API 계약을 먼저 운영 검증한다. signed 이미지 주소를 로그·Git JSON에 노출하지 않고 해시로 조건을 관리한다.
3. 현재 body 및 metadata 해시가 요청과 다르면 저장 전에 중단한다. original HTML에서 지정 alt만 변환한다. Editorial 재렌더·새 이미지 업로드·대표 삭제/교체·태그/category 입력을 수행하지 않는다.
4. editor에 변환 HTML을 입력한 뒤 CodeMirror 값을 다시 읽어 targetBodySha256 일치를 확인한다. 예기치 않은 editor 정규화가 있으면 낮춘 비교로 통과시키지 않고 중단한다.
5. 발행창을 여는 동안 metadata가 그대로인지 다시 읽어 expectedMetadataSha256을 대조한다. 특히 대표 이미지 기본값 변화 및 공개/비공개 변화가 없음을 확인한다.
6. 최종 클릭 직전에 기존 source drift gate와 원장 submitting write를 재사용한다. fingerprint에 operation/본문 조건/metadata 조건/정확 patches를 포함한다. 기존 submitting/updated와 충돌하면 무조건 다시 제출하지 않는다.
7. 최종 버튼은 정확히 한 번 클릭한다. 불확실하면 기존 read-only 복구 경로로 전환한다. metadata capture 실패를 원고 실패로 가장하지 않는다.
8. 익명 PC/모바일 공개 검증은 해당 alt와 img src 동일성을 확인한다. 공개 HTML이 editor와 다르게 wrapper를 추가한다면 검증된 원본문 추출 계약을 사용한다. 제목/카테고리/태그/대표 OG/visibility 보존도 검사한다. 이미지가 실제 열리고 대상 alt가 정확히 반영됐을 때만 원장 updated로 전환한다. legacy 1장/10장 본문에 R1 3장 조건을 강제하지 않되 기존 이미지 수·순서·src 불변을 검사한다.

## 실제 DOM 관찰과 구현한 표준 경로

공식 Chrome의 기존 `/331` editor를 읽기 전용으로 관찰했다. title은 `#post-title-inp.value`, category는 `#category-btn .mce-txt`, tags는 `.txt_tag a[aria-label$=" 태그 수정"]` 10개로 읽는다. 대표 이미지는 `<img>`가 아니라 `.publish_editor .box_thumb .thumb_g`의 inline `background-image`에 원래 URL이 있다. visibility는 `name=basicSet` radio 3개 중 checked value `20`이다. 발행창을 열어 읽고 취소했으며 최종 공개 발행·본문 입력·이미지 변경은 하지 않았다. 이 관찰은 필드 출처 확인이며 실제 alt 적용 전후 보존 검증을 대신하지 않는다.

`alt-maintenance-observe.mjs`는 이 DOM 계약을 사용해 원래 대표 URL을 출력하지 않고 metadata 해시를 만든다. 대표 없음·태그 0개 등 실측하지 않은 레이아웃은 해당 글만 중단한다. private/protected 글은 public 전용 유지보수 작업에서 거부한다.

기존 `update-core`, `validate-content`, `validate-update`, `prepare-selected-source`, `update`, `finalize-update`에 명시적인 operation 분기를 배선했다. source는 기존 id/articleId/targetUrl/title/expectedCurrentTitle/ready/approved와 maintenance 조건만 허용하며 제목 변경·새 본문·대표·category 입력을 허용하지 않는다. R1/SP1을 가장하지 않는다. 기존 source gate, single-source 선택, browser mutex, UpdateLedger는 유지한다.

`alt-maintenance-runner.mjs`는 현재 metadata 확인 → 원본문 해시 및 이미지 조건 일치 → 발행창 취소 → 익명 공개 기준 확보 → 지정 alt만 stage → 실제 CodeMirror 문자열 해시 재확인 → 발행창 metadata 전후 일치 → submitting 선기록 → 최종 공개 발행 정확히 1회 → 익명 검증 순서다. 기존 submitting 상태가 있거나 결과가 불확실하면 재제출하지 않는다.

`alt-maintenance-public.mjs`는 provider 응답 HTML에서 정확히 1개 `.contents_style`을 DOMParser로 추출하고 img의 alt 속성만 제외한 본문 전체 해시를 비교한다. 광고·목차·사진 확대 `aria-label` 등 스킨의 후속 DOM 삽입이 원문 hash에 섞이지 않도록 범위를 분리했다. 렌더된 사진의 src/alt는 provider 원문의 사진 목록과 별도로 일치해야 하며 decode 성공·사진 수·순서·가로 넘침도 검사한다. 본문 비교를 통과시키기 위해 prose/링크/임의 속성을 제거하지 않는다.

공개 `/331`에서 `.hd .meta-cate a` 1개(음식), `.entry-tag a` 10개, 본문 사진 8개를 실제 확인했다. 공개 제목·category·태그 집합·대표 원래 asset이 editor 의미와 일치해야 기준을 생성한다. category에는 변하는 개정 날짜를 포함하지 않는다. 원본문·meta 기준은 PC 1440과 모바일 390 각각 확보하고 같은 폭에서 다시 읽어 불안정한 기준이면 stage 전에 중단한다. 원장에 signed URL·전체 HTML을 저장하지 않고 해시·기대 alt·정확 이미지 index를 보존한다. alt 공개 반영과 전후 보존이 확인될 때만 updated로 전환한다.

익명 HTTP 원문 `/331` 2회는 사진 8개 및 alt 제외 본문 SHA `de03b3fe1d59776b68685268bef82978dba191a40994ba6123d1ec4db3e57865`가 일치했다. 이는 provider 원문 안정성 진단이며 실제 PC/mobile runner 공개 검사나 alt 발행 PASS가 아니다.

## 현재 검증과 남은 범위

전체 package test **363/363 PASS**. 신규 계약·DOM 관찰·runner/원장/공개 검증·읽기 전용 snapshot 테스트 29개를 package test에 추가했다. 기존 source-gate/mutex/일반 수정 경로 회귀 검사를 유지했다. `update.mjs` 구문 검사 및 diff whitespace 검사 PASS. 처음에는 새 worktree 의존성 연결이 없어서 검사 로드가 차단됐으며, 기존 동일 lock 환경의 node_modules를 연결한 뒤 위 검사를 완료했다.

실제 최종 저장·원격 commit/push/배포 없음. six legacy 글의 editor 원본문/metadata 조건을 private로 확보하고 실제 runner dryrun을 수행하는 단계는 아직 완료하지 않았다. `/331` HTML 보기 전환 확인창 이후 공식 브라우저의 포커스 CDP timeout으로 read/copy 및 탭 종료 명령이 완료되지 않았다. 최종 제출은 실행하지 않았으며 동일 실패를 반복하지 않았다. 자동화 관찰 제약을 실제 서비스 FAIL로 판정하지 않는다. 이후 환경 복구 시 읽기 전용 조건 snapshot부터 재개해야 한다.

alt 보완은 이미지 권리 확인 또는 기존 건강 주장 전체 감수 완료가 아니다. 시각 검토 6장 중 `/276` 사진은 라이코펜 제품이라 토마틴 문맥과 불일치하며, 6장의 라이선스는 아직 UNKNOWN이다. 해당 사항을 alt-only PASS로 은폐하지 않는다.

테스트: `node --test`와 package.json `test`에 등록된 파일 전체. 결과 로그 `alt-maintenance-test-results.log`는 로컬이며 commit 대상이 아니다.

## GUI 관찰 제약에 대한 표준 읽기 전용 러너 경로

`observe-alt-maintenance.yml`은 수동 dispatch·main·기존 self-hosted Windows 라벨·CMD·source gate·공통 browser mutex를 유지한다. contents 권한은 read이며 update/publish/원장 write를 실행하지 않는다. `publishing/alt-maintenance-snapshot.mjs`는 승인된 시각 검토 6장만 고정 선택하고 현재 제목을 읽은 뒤 기존 관리자 probe와 HTML 모드 제어를 재사용한다. `selectEditorMode` 및 `probeManagedPost`는 동작 변경 없이 `update-editor-controls.mjs`로 이동해 수정 경로와 관찰 경로가 같은 구현을 사용한다.

snapshot은 기본모드 발행창 읽기·취소 → HTML mode 원본문 읽기 → 기본모드 발행창 재읽기·metadata 동일 확인·취소를 수행한다. `preparePublishEditor`는 제목 fill을 포함하므로 이 read-only 경로에서는 호출하지 않고 기존 `openPublishDialog`의 readiness 검사만 사용한다. 본문 입력·title fill·대표 변경·최종 발행·원장 write가 없다. 기존 opaque `[##_Image|...]` 매크로를 img로 추정하지 않고 `E_ALT_EDITOR_MACRO_UNSUPPORTED`로 해당 글만 중단한다.

원본문과 signed 대표 주소는 `%LOCALAPPDATA%/NHUNNHUN/alt-snapshots/<runId>/<articleId>.raw.private.json`에만 보관한다. 공유할 조건은 원본문/대표/이미지 URL 자체를 포함하지 않는 SHA 기반 draft이다. status=draft, approved=false로 생성하여 root의 실제 조건·권리·문맥 검토를 대신하지 않는다.

GitHub repository가 public일 수 있으므로 artifact는 공개 평문으로 올리지 않는다. 조건 draft 묶음을 AES-256-GCM으로 암호화한 `conditions.enc.json` 한 파일만 upload-artifact에 전달하고 보존 기간을 3일로 한정한다. 무작위 256-bit key는 같은 local private 폴더의 `artifact.key`에만 보관하며 로그·Git·artifact에 포함하지 않는다. 로컬 root는 `conditions.private.json`을 직접 읽어 검토할 수 있고 key를 사용자에게 노출·복사 요청할 필요가 없다. workflow가 원격에서 실행돼 성공한 증거는 아직 없으며 조건 snapshot 확보 완료로 보고하지 않는다.

