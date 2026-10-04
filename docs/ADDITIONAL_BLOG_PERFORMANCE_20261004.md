# 질병·의약품 블로그 공통 성능 적용 — 2026-10-04

## 적용 완료

- enfermedad.tistory.com과 123ewq.tistory.com의 공식 관리자 HTML/CSS 원본을 각각 로컬 private로 백업하고, 블로그별 식별자를 보존한 변경본을 공식 편집기에서 저장했습니다.
- 검증된 optimizeHtml/stabilizeDesktop 공통 모듈을 재사용했습니다. CSS 파일은 원본 그대로 유지합니다. 본문 표시 opacity 변경과 다른 블로그의 /6 이미지 맵은 적용하지 않았습니다.
- tjQuery를 window.jQuery와 window.$ 모두에 연결해 실제 common.js의 `$ is not a function` 오류를 수정했습니다. 기존 scripts 순서/광고/분석 코드와 body는 그대로 유지합니다.
- 시스템 글꼴, Material Icons 초기 1em 공간, CSS preload, 중복 preconnect 정리 및 기존 메인의 데스크톱 critical layout을 적용했습니다.
- 글 페이지에서 실제 description 2개를 확인해 스킨의 generic description 태그만 제거했습니다. 공개 글/홈에서 description 1개와 정상 canonical을 확인했습니다.
- enfermedad 모바일웹 자동 연결은 기존 ON에서 OFF로 저장했습니다. 반응형 운영 스킨을 모바일에서도 사용합니다. 123ewq는 이미 측정에서 원래 URL로 연결되므로 해당 관리자 설정을 변경하지 않았습니다.

## 공식 PageSpeed 측정

| 블로그/페이지 | 모바일 전→후 | PC 전→후 | 모바일 LCP 전→후 | 모바일 CLS 전→후 |
|---|---|---|---|---|
| enfermedad /2 | 55→64 | 85→89 | 14.6→6.2초 | 0.064→0 |
| 123ewq /8 | 59→63 | 38→85 | 7.7→6.2초 | 0→0 |

각각 전후 1회 실험실 측정입니다. 광고/네트워크 응답에 따른 변동이 있으며 모두 스킨 개선만의 효과라고 단정하지 않습니다. 특히 123ewq PC 초기 TBT 1610ms, 변경 후 70ms의 차이에는 광고 응답 변동이 포함될 수 있습니다. enfermedad 모바일 초기 결과는 /m/2였고 변경 후 /2로 검증되었습니다. 실사용자 데이터가 없어 Core Web Vitals 합격으로 판정하지 않습니다.

- enfermedad 전: https://pagespeed.web.dev/analysis/https-enfermedad-tistory-com-2/f80uuv1vva?form_factor=mobile
- enfermedad 후: https://pagespeed.web.dev/analysis/https-enfermedad-tistory-com-2/ci8vd8622n?form_factor=mobile
- 123ewq 전: https://pagespeed.web.dev/analysis/https-123ewq-tistory-com-8/80kh52dmi4?form_factor=mobile
- 123ewq 후: https://pagespeed.web.dev/analysis/https-123ewq-tistory-com-8/yaqdmeu6q0?form_factor=mobile

## 검증

원본 대비 body 동일, 기존 script 보존(jQuery bridge 제외), 광고/stylesheet 보존, 패치 idempotence 검사 PASS. 실사이트에서 PC 1440 / 모바일 390의 가로 넘침 0, 공개 본문과 홈 정상, fresh tab 콘솔 오류 0, description 1개, 정상 canonical을 확인했습니다. 최종 SEO 점수는 둘 다 100입니다.

## 소스와 복구

현재 인증된 GitHub 계정에서 두 블로그의 별도 repo는 발견되지 않았습니다. 임의 새 저장소/발행 자동화를 만들지 않고 이 저장소 skin/reference/additional/ 아래 검토용 HTML/CSS만 보존합니다. 검토 HTML은 인증·광고·분석 식별자를 REDACTED 처리했으므로 직접 적용/rollback 금지입니다. 이 파일을 추가해도 기존 메인 블로그와 nutriments 운영 스킨/발행 workflow는 변경되지 않습니다.

전체 ZIP 백업으로 주장하지 않습니다. 원본 HTML/CSS와 실제 적용본은 로컬 프로젝트 work/additional-blog-performance-20261004/의 `<host>-original.private.html`, `<host>-original.private.css`, `<host>-final.private.html`에 있습니다. 다른 스킨 자산은 변경하지 않았습니다. 복구할 때는 현재 편집 내용을 먼저 다시 백업하고 해당 블로그 공식 관리자에서 해당 원본 HTML/CSS만 저장합니다. 필요 시 enfermedad 모바일웹 연결을 기존 ON으로 되돌립니다. GitHub REDACTED 사본이나 다른 블로그의 식별자를 적용하지 않습니다.
