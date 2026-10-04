# NHUNNHUN 콘텐츠 품질 감사 및 우선 수정 결과

기준일: 2026-10-04 (Asia/Seoul)
대상: https://nhunnhun.tistory.com/
점검 범위: /110, /111, /112, /353, /354 — 5개 공개 글의 우선 점검. 전체 글 전수 점검이 아님.
실제 본문 최신화: /110, /112 — 2개. 기존 숫자 URL 유지.
다른 블로그 변경: 0. 신규 글 발행: 0.
작업 시작 main: 80391989641dd4037d58cd3bf4285ac0416780f2.

## 우선 수정 결과

| 글 | 수정 전 핵심 문제 | 조치 | 상태 |
|---|---|---|---|
| /112 카페인 | 400mg을 권장량으로 오인하게 하는 표현, 영양제 병용 효과 단정, 반복 한영 본문 | 일반 안전성 참고값과 필요량 구분; 금단·감량·약물 및 알코올 병용 주의 정리; 출처·비교표·FAQ·R3 구조 보강 | 실제 수정 완료, ledger updated |
| /110 사포닌 | 사포닌과 비타민 B5 혼동, 보편적 100~200mg 권고, 출처 불명 함량 수치, 질병 예방 및 체지방 감소 일반화, AI 잔여 문구 | 성분군·인삼·진세노사이드·판토텐산 구분; 검증되지 않은 수치와 제품 설명 제거; 동물 연구와 인체 효과 구분 | 실제 수정 완료, ledger updated |
| /111 커피 역사 | 도입부의 운영 설명, 부자연스러운 요약 제목 | 개선 항목 기록. 이번 작업에서 재수정하지 않음 | 문장 개선 대기 |
| /353 대하 | 종 구분 및 식품의 질병 예방 효과 설명 재검토 필요 | 다음 사실 검증 대상으로 기록 | 미수정 |
| /354 꽃게 | 껍질 성분 연구와 일반 섭취 효과 혼용, 출처 불명 영양 수치 | 다음 사실 검증 대상으로 기록 | 미수정 |

## 실제 실행 증거

| 글 | source commit | 표준 update run |
|---|---|---|
| /112 | 263301d5e5ecae4cd72265cf95011f7ea17a5aa1 | 37180074635 — SUCCESS |
| /110 | 6913a9f61889e42d2f79dbe205099f73aae2d212 | 37180266623 — SUCCESS |

/112 제목: 카페인 작용·부작용·금단 증상과 줄이는 방법
/110 제목: 사포닌 효능·부작용과 함유 식품｜권장량·홍삼과의 차이

| R3 항목 | /112 | /110 |
|---|---:|---:|
| H2 | 10 | 9 |
| H3 | 3 | 3 |
| 표 | 2 | 2 |
| 본문 이미지 | 3 | 3 |
| 형광펜 | 7 | 8 |
| 강조 색상 | 4 | 4 |
| FAQ 문답 | 5 | 5 |
| 관련 글 | 2 | 1 |
| ledger | updated | updated |

두 실행 모두 기존 URL 수정 경로(update-posts.yml → publishing/update.mjs)를 사용했다. 카테고리·태그를 수정하는 동작은 하지 않았다.

## 검증 보강

기존 자동 검증의 4px 가로 넘침 허용 및 이미지 로딩/대표 이미지 내용 대조 누락을 보완하기 위해 읽기 전용 익명 공개 검사를 표준 update workflow에 추가했다.
- 문서 가로 넘침 1px도 실패 처리.
- 실제 이미지 로딩, alt, 원본 호스트, eager/lazy 검사.
- H2/H3 computed style, 반응형 표와 실제 형광펜 배경 검사.
- 대표 이미지·본문 첫 이미지·승인한 원본 파일 내용 대조.
- 기본 28개 테스트에 공개 검사 단위 테스트 11개 추가.
- 인증 프로필 내보내기, 관리자 조작, ledger 변경은 하지 않는 검증 모듈.

추가 공개 검사도 최종 PASS했다. /111은 기존 업데이트 결과를 재검증만 했으며 이번 실제 본문 수정 건수에 포함하지 않는다.

## 사실 확인에 사용한 주요 출처

- FDA: https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much
- EFSA: https://www.efsa.europa.eu/en/topics/topic/caffeine
- MedlinePlus: https://medlineplus.gov/caffeine.html
- MedlinePlus 의학백과: https://medlineplus.gov/ency/article/002579.htm
- CDC: https://www.cdc.gov/alcohol/about-alcohol-use/alcohol-caffeine.html
- NIH ODS: https://ods.od.nih.gov/factsheets/PantothenicAcid-Consumer/
- NCCIH: https://www.nccih.nih.gov/health/asian-ginseng
- NCCIH: https://www.nccih.nih.gov/health/using-dietary-supplements-wisely
- Cornell University: https://poisonousplants.ansci.cornell.edu/toxicagents/saponin.html (정의와 식물 분포용)
- Silva 등, 2021 원문 연구: https://pubmed.ncbi.nlm.nih.gov/34860581/

사진별 원저작자·원본 링크·라이선스는 각 글의 자료 출처에 기재했다. 검색 성과와 색인 개선은 이번 작업에서 측정하거나 주장하지 않는다.

## 추가 검사에서 확인한 검증기 오류와 수정

- 최초 추가 QA run 37180562647: E_QA_IMAGE_FETCH. 이미 완료된 게시물에 대한 재수정은 없었음(NO_PENDING_UPDATES).
- 진단 run 37180799367: /110·/111·/112의 실제 공개 PC 본문·계산된 스타일·이미지 로딩은 정상. 대표/본문 이미지는 HTTP 200, Content-Type application/octet-stream이고 승인 원본은 image/jpeg임을 확인.
- 원인: 새 검증기가 image/* MIME만 허용하여 실제 로딩된 Tistory .bin 이미지를 거부함.
- 수정: 지원 이미지의 바이너리 시그니처를 확인하고, 원본·본문 첫 이미지·대표 OG 파일의 SHA256 완전 일치 조건은 유지. HTML 응답이나 잘못된 바이너리는 차단.
- 최종 검증 코드 commit: e5a93a4320aa176979d406baef8e5f847b521084.
- 최종 확인 run: 37181010203.

실제 콘텐츠 변경 없이 읽기 전용 검사만 수정·재실행했다. 기존 updated ledger는 삭제하거나 덮어써 재발행하지 않았다.

## 최종 익명 공개 검증 — PASS

최종 run: 37181010203 — validate-update / update 모두 SUCCESS.
최종 job: 111373453653.
Runner: c06-tistory-publisher; Windows self-hosted; CMD 실행 로그 확인.
라벨 계약: self-hosted, windows, x64, tistory-publisher.
검증 코드 SHA: e5a93a4320aa176979d406baef8e5f847b521084.
테스트: 기존 28/28 + 추가 11/11 = 39/39 PASS.
Source validate: 3 updates validated; editorial=R3.
표준 update 실행 결과: NO_PENDING_UPDATES — 추가 Tistory 저장 없이 공개 재검증만 수행.
PUBLIC_QA_COMPLETE: 3 (/110, /111, /112).
공개 검증 완료 시각: 2026-10-04 14:50:57 KST.

| 실제 공개 검사 | /110 | /111 (재검증만) | /112 |
|---|---|---|---|
| 제목·전체 본문 및 canonical | PASS | PASS | PASS |
| PC 1440px / mobile 390px | PASS / PASS | PASS / PASS | PASS / PASS |
| PC / mobile 문서 가로 넘침 | 0 / 0px | 0 / 0px | 0 / 0px |
| 깨진 이미지 / alt 누락 / 넘침 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 본문 이미지 kakaocdn | 3/3 | 4/4 | 3/3 |
| 원본 = 첫 이미지 = 대표 OG 내용 SHA256 | 일치 | 일치 | 일치 |
| H2/H3 computed style 오류 | 0 | 0 | 0 |
| 표 wrapper 오류 | 0 | 0 | 0 |
| 형광펜 배경 미표시 | 0 | 0 | 0 |
| 관련 내부링크 실제 응답 | 1/1 정상 | 2/2 정상 | 2/2 정상 |

이번 개선 범위는 /110·/112 실제 최신화와 공개 검증기 보강이다. /111 문장 개선, /353·/354 재작성과 블로그 전체 전수 점검은 미완료이며 완료로 보고하지 않는다.
