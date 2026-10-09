# 출처·성분 오류 수정 및 제출 검사 일치화

대상: 한입 건강. 실제 공개 반영과 코드 검사 결과를 분리한다. 이번 두 글 수정만으로 32개 운영 항목 전체를 완료로 바꾸지 않는다.

## 실제 공개 수정 완료

|글|오류 및 변경|공개 증거|
|---|---|---|
|/264 아세트아미노펜|사라진 약학정보 PDF를 정확한 국내 타이레놀 500mg 허가사항으로 교체. 제품별 용법·금기·성분 중복·과량 시 무증상 의료평가·어린이·보관 기준을 대조하여 재작성|PR #138, Run [38000916317](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/38000916317), PUBLIC_VERIFIED/updated|
|/237 카르바크롤|Carvacrol과 Carbazole의 성분 혼동, 근거 없는 항암·감량·해독 효과, 1,000~1,200mg 권장량과 가상 브랜드 추천 제거. Carvacrol 식별정보·연구 유형·허브와 농축 제품·시험 용량과 개인 권장량 구분으로 재작성|PR #139, Run [38001402880](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/38001402880), PUBLIC_VERIFIED/updated|

두 실행 모두 PC1440/모바일390 넘침0px, 사진3장·로딩 오류0·alt누락0·대표 이미지 확인. 메인 Codex가 공개 본문과 개정일을 직접 읽고 화면을 저장했다. /237 구조식의 실제 computed object-fit은 contain, 높이420px이며 로딩 완료. 각 번호 URL을 유지하며 중복 신규 글을 만들지 않았다.

이미지3장의 Commons 실제 사진·작가·라이선스를 각각 확인했다. 독립 의학 감수는 수행하지 않았다. /237 PubChem 일부 직접 페이지 및 NIH LiverTox는 접근 제한이 있어 검색에 노출된 식별정보·본문 범위를 기록했으며 전문 직접 열람이라고 보고하지 않았다. 사람 대상 연구는 PubMed 초록 범위이다. 자료 확인일을 과거 자료의 발표·개정일로 바꾸지 않았다.

원장: `publishing/update-state/update-264-acetaminophen-source-review-20261010.json`, `publishing/update-state/update-237-carvacrol-identity-review-20261010.json`.
로컬 화면·원장: 루트 `evidence/health-growth-final-20261010/remaining-repairs/`. 계정 화면이나 전체 원자료는 커밋하지 않는다.

## Source Drift 검사 불일치

신규 발행 Run [38001241130](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/38001241130)은 테프의 발행창 지연과 다른 문제다. 최종 제출 전 `E_SOURCE_DRIFT`를 확인했다. 해당 실행에서는 최종 클릭·submitting 기록 전에 차단됐다. 이 문서는 그 글의 재제출·발행 결과를 대신 판정하지 않는다.

직접 원인: `publish.mjs`는 공통 `assertCurrentSource()`를 다시 부르기 직전에 remote main SHA 완전 일치를 별도로 강제했다. 공통 검사에서 이미 허용하는 다른 글의 수정·문서 변경도 이 별도 검사에서 거부할 수 있었다. 또한 다른 글의 업데이트 원고는 허용하면서 그 글의 `content-reviews/updates` 검토서는 구분하지 않아 차단했다.

조치:
- 제출 checkpoint 직전에 공통 `assertCurrentSource()`를 실행하고 그 검사의 checkout SHA를 기록한다. 원격 조회·workflow/checkout 일치·앞선 이력·변경 경로 검사는 유지한다.
- 다른 ID의 업데이트 원고·검토서·수정 원장만 기존 문서 허용 범위와 함께 구분한다. 대상 원고/검토서/원장, 신규 posts 파일, 실행 코드, 의존성, 알 수 없는 경로는 차단한다.
- 대상 ID가 없거나 workflow/checkout이 다르면 허용하지 않는다. checkpoint 이전 검사 및 불확실 제출 재시도 금지를 유지한다.

검증: 관련 검사53/53, 전체 회귀307/307 PASS. 동일 변경 범위의 GitHub CI에서 추가 확인한다. 검사 개선 후 실제 신규 발행은 이 변경 검증 목적으로 새로 실행하지 않았으며 Production 재현 완료로 보고하지 않는다.

## 남은 범위

전체 근거126개 후보·주장별 날짜/내용, 과거 글 전체 의미 감수·이미지 라이선스·색인·성과는 여전히 남아 있다. /264 PDF 교체 및 /237 위험한 성분 오류 수정의 완료 증거만 추가했다. 전체 현황은 [32개 운영 기록](HEALTH_GROWTH_STATUS_20261010.md)을 따른다.
