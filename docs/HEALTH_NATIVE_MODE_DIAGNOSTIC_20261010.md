# HTML 모드 원문 불일치 최소 진단 후보

기준: 실제 루트 `91c081a`. 별도 `health-native-mode-diagnostic-20261010`. 원격 실행·원고 승인·조건 재작성 없음.

기존 실제 preflight `38017438823`의 3개 `E_TEXT_BODY_DRIFT` 판정은 유지한다. 새 진단이 이미지 직렬화 차이를 보이더라도 exact body hash gate를 PASS로 바꾸지 않는다.

기존 read-only preflight가 실제 HTML mode 문자열을 메모리에서 읽은 직후, body mismatch인 경우에만 LOCALAPPDATA의 승인된 `{236,233,200}-editor-current.private.html`을 읽어 비교한다. 이 역사적 파일의 hash부터 현재 후보 expectedBodySha256과 맞아야 하며 다르면 `E_NATIVE_MODE_REFERENCE_BODY_DRIFT`다.

안전 결과:

- 전체 body byte 동일 여부와 UTF-8 byte 수.
- 전체 텍스트 hash 동일 여부.
- text slot 수, raw sequence hash 동일 여부, offset/rawhash 동일 여부, 기존 선언 patch 중 실제 mode slot과 정확히 일치하는 수.
- 이미지 수, asset·caption sequence 동일 여부, 매크로 byte/canonical 동일 여부, 알려진 dimension number/string 타입 변화 수.
- 매크로를 고정 placeholder로 제외한 나머지 body byte 동일 여부.

canonical 비교는 모든 JSON 필드를 보존하고 알려진 dimension의 정수 숫자/문자열만 대조한다. signed reference는 기존 asset identity가 같고 허용 query key 집합도 같아야 한다. 알 수 없는 key·중복 JSON 필드·다른 asset/caption/style/수치 변경은 이미지 직렬화 차이로 인정하지 않는다.

기존 `alt-native-recovery-proof`의 직접 API는 alt patch 적용 결과와 사후 복구 증명을 요구하므로 현재 "변경 전 3글 read-only 차이 분류"에 그대로 호출하기에는 맞지 않는다. 기존 nativeImages/asset identity/hash 모듈을 재사용하며 해당 proof의 dimension 정수/string·signed key 제한을 같은 원칙으로 적용했다. 원장 수정이나 복구 증명을 새로 선언하지 않는다.

원문·URL·caption/text·메타 본문은 stdout/Git/artifact에 남기지 않는다. 원본과 actual HTML을 새 파일로 저장하지 않는다. 모든 결과에 publicationEnabled:false/sourceRewritten:false를 명시한다.

검증: 신규 진단 회귀10 PASS, 관련 preflight와 합계19 PASS, 프로젝트 등록 전체 **469 PASS**. 실제 러너 진단은 미실행이다. 실행과 조건별 판정 수집은 루트 담당이다.

별도 NBSP 초안 교정: /236의 알려진 newText 2개에 있던 literal entity 5개를 Unicode NBSP로만 교체했다. 원문 expectedBody/metadata 조건은 유지했고 targetPublicText hash를 다시 계산했다. cleanup 80개 토큰을 재계산해 기존 배열과 정확히 같음을 확인했다. 초안은 draft/approved:false다. tests/native-text-entity.test.mjs 1 PASS로 일반 HTML escaping 보호를 유지하면서 literal entity 노출을 막는다. 기존 private provider와 target DOM 대조는 mappedBlocks 77 PASS이며 새 target HTML은 저장하지 않았다.
