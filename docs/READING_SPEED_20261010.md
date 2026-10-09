# 읽기 스킨 초기 렌더링 개선

본문 목차를 DOMContentLoaded 이후 추가하고 제목을 늦게 분리하면 초기 화면이 이동한다. 목차 생성은 본문 치환자 바로 뒤로, 제목·날짜 보정은 제목 치환자 바로 뒤로 이동했다. 이미지 비율과 제거된 UI의 숨김은 초기 인라인 CSS로 확보한다. 대표 이미지의 fetchpriority를 high로 지정한다.

기존 reader-tools를 재사용한다. 게시 원고·숫자 URL·광고·통계·워크플로우는 변경하지 않는다. 중복체크 UI 제거 후 남은 이벤트 등록에는 null 보호를 적용한다. 초기 도구는 직접 실행하되 같은 도구를 중복 생성하지 않는다.

## 운영 원본과 복구

- 실제 최신 비공개 HTML을 먼저 백업한다. `skin/reference`의 REDACTED 사본을 배포하지 않는다.
- `node scripts/optimize-reading-stability.mjs <private-original.html> <separate-private-output.html>`로 별도 출력한다.
- 스킨 UI 저장 후 공개 페이지의 초기 실행 위치, 목차·상단 버튼·날짜, 이미지 확대, 390px 넘침과 콘솔을 확인한다.
- 출력은 기존 공통 reader/reading-layout 스크립트가 각각 하나인 원본만 허용한다. 반복 적용은 변경하지 않는다.
- CSS/JS 검토 파일은 배포 차분이다. 전체 운영 스킨은 공개 저장소에 보관하지 않는다.

## 검증 범위

- 단위 검사: `node --test tests/reading-stability.test.mjs`.
- JS 구문 검사: reader-tools, reading-layout, reading-header.
- 공개 `/282`, `/251`에서 초기 목차·제목·날짜 생성 확인.
- `/282`의 390px 가로 넘침 0, PC hover 목차 9개, 확대 사진의 원본 주소 유지 확인.
- 반응형 CDN srcset 실험은 측정상 개선 근거를 확보하지 못해 운영에서 철회했다.
- PageSpeed 단일 측정은 변동하며 실제 사용자 CWV 데이터는 없었다. 모바일 CLS가 0인 측정도 있었으나 LCP 지연은 남았다. 전체 속도 해결 또는 개선률 확정으로 보고하지 않는다.

티스토리 기본 CSS·jQuery·Kakao SDK 등의 초기 차단과 외부 광고/통계 캐시 수명은 이번 스킨 변경으로 제거하지 않았다. 의존 순서나 서비스 기능을 확인하지 않고 플랫폼 스크립트를 async 처리하거나 삭제하지 않는다.
