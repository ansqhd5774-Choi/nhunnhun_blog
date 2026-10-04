# 두 블로그 공통 성능 적용 — 2026-10-04

## 실제 변경

- 공식 관리자에서 확보한 HTML/CSS를 private 백업한 뒤 적용했습니다. 본문, 기존 광고/분석 코드 및 검색 인증은 보존했습니다.
- native tjQuery를 window.jQuery와 window.$에 함께 연결하여 실제 common.js의 `$ is not a function` 오류를 해결했습니다. 기존 비동기 common.js 정책은 유지합니다.
- 기존 메인 스킨의 시스템 글꼴 정책을 공통 적용하고 Material Icons는 유지했습니다. 아이콘에 초기 1em 공간을 예약하여 글꼴 도착 시 레이아웃 이동을 줄였습니다.
- 외부 style.css는 유지하고 조기 preload를 추가했습니다. 중복 preconnect를 5개 스킨 원천으로 정리했습니다. 티스토리/광고가 추가한 연결은 별개입니다.
- nutriments는 기존 메인 데스크톱 critical layout을 재사용했습니다. 본문 초기 opacity 변경은 모바일 회귀가 관측되어 원본 CSS로 복구했습니다. 모바일 자동 /m/ 이동은 OFF로 저장했습니다.
- /6의 실제 관측한 이미지 6개 식별자에만 치수 및 비율 보존 WebP srcset을 적용했습니다. 현재 공개 이미지 3개 WebP 로딩을 확인했습니다. 원본 src와 OG URL은 보존하며 오류 시 원본으로 돌아갑니다. 다른 이미지/페이지에는 임의 크기 추정이나 변환을 하지 않습니다.

## 검증

원본 대비 body 및 기존 script 보존(명시한 jQuery bridge 제외), idempotence, 이미지 원본 src/fallback, 폰트 정책 및 초기 아이콘 예약 검사를 통과했습니다. 전체 테스트: main 51/51 (최신 main 통합 후), nutriments 31/31. 게시물 발행/runner workflow는 변경하지 않았습니다. 로컬 발행 validate는 GitHub ledger 환경이 없어 E_GITHUB_CONFIGURATION이므로 PASS로 표시하지 않습니다.

공개 /366 및 /6에서 시스템 글꼴, 정상 본문, 모바일 390 폭의 가로 넘침 0, jQuery 오류 0을 확인했습니다. 상세 실험 결과는 아래 측정표에 별도 기록합니다.

## 측정의 한계

PageSpeed 공식 Lighthouse 13.5 실험실 측정입니다. 실사용자 데이터가 없어 Core Web Vitals 합격으로 판정하지 않습니다. 광고 응답과 외부 카카오 telemetry 429에 따라 성능/권장사항 점수가 변합니다. 나쁜 결과도 제외하지 않습니다. nutriments /6 이미지는 다른 발행 작업에서 이번 감사 중 갱신되어 전후 콘텐츠가 완전히 같지는 않습니다. 이미지 크기 변화만을 스킨 개선 효과로 주장하지 않습니다.

## 백업과 복구

전체 스킨 ZIP을 새로 만들었다고 주장하지 않습니다. 수정 대상인 HTML/CSS 원본은 로컬 private에 보존하며 나머지 자산은 변경하지 않았습니다. 해당 PC 프로젝트의 work/search-index-audit-20261004/ 아래 main-perf-original.private.html/.css 및 nutri-perf-original.private.html, nutriments-style-original.private.css를 사용합니다.

복구할 때는 현재 편집 내용을 다시 백업하고, 공식 관리자 스킨 편집에서 해당 블로그의 원본 HTML/CSS만 복구합니다. 메인 GitHub REDACTED 사본을 직접 적용하지 않습니다. nutriments의 모바일 전환 설정은 관리자 모바일웹 메뉴에서 필요 시 기존 사용 상태로 되돌립니다. 글/발행 ledger 및 다른 블로그 식별자를 덮어쓰지 않습니다.

## 최종 측정

| 대상 | 초기 모바일 / PC | 최종 모바일 / PC | 모바일 LCP | 모바일 CLS |
|---|---|---|---|---|
| 메인 /366 | 61 / 87 | 중앙값 62 / 90 | 중앙값 7.0초 (초기 7.7초) | 0.002 유지 |
| nutriments /6 | 60 / 77 | 62 / 91 | 6.9초 (초기 /m/6 15.1초) | 0 (초기 /m/6 0.174) |

메인 최종 설정 3회 실험: 모바일 61,62,65 / PC 91,72,90. PC 72점의 회귀 관측도 제외하지 않았으며 CLS 0.268을 기록했습니다. 고정된 점수 향상을 보장하지 않습니다. 대표 최종 보고서: https://pagespeed.web.dev/analysis/https-nhunnhun-tistory-com-366/r45fv8dw0d?form_factor=mobile . 나머지는 wa5gra7ost,19okpe9jxj 보고서입니다.

nutriments는 CSS opacity 변경이 들어간 실험에서 모바일 44점 / CLS 0.399가 관측돼 초기 표시 변경을 철회하고 원본 CSS로 복구했습니다. 복구된 최종 결과는 1회 측정이며 3회 독립 측정으로 주장하지 않습니다: https://pagespeed.web.dev/analysis/https-nutriments-tistory-com-6/z45u6r0vcw?form_factor=mobile . 최종 SEO는 두 사이트 모두 100입니다. 권장사항 96의 일부 원인은 카카오 외부 telemetry의 HTTP 429이며 본문/메뉴 jQuery 오류와 구분합니다.

본문과 광고는 그대로 유지했습니다. 대용량 이미지 최적화는 최신 /6의 native src / OG를 보존한 WebP 실제 로딩으로 확인했고, 향후 새 이미지 전체에 무조건 적용되는 범용 규칙으로 확대하지 않았습니다.
