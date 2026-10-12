# 쿠팡 파트너스 API 연동 기준

이 연동은 상품 후보 검색과 제휴 딥링크 생성만 제공한다. API 응답만으로 상품을 자동 선택하거나 게시물·원고·발행 원장을 자동 변경하지 않는다. 제휴는 글별 `affiliateProducts`를 명시적으로 선택하고 `reviewed: true`로 승인한 경우에만 표시한다. 기존 글은 이 필드가 없으므로 영향받지 않는다.

## API 사용

Node.js 20 이상에서 `publishing/coupang-partners.mjs`의 `CoupangPartnersClient`를 사용한다. 수동 API 작업은 `.github/workflows/coupang-partners-api.yml`에서 상품 검색 또는 딥링크 변환으로 실행한다. 자동 발행 워크플로에는 연결하지 않았다. 인증은 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` 환경변수에서 읽고, 호출 횟수 원장은 self-hosted 러너 사용자 홈의 `.nhunnhun/coupang-partners-rate-state.json`에 자동 보존한다. 선택적으로 `COUPANG_RATE_STATE_PATH`로 이 경로를 바꿀 수 있지만 저장소 안 경로는 거부한다. 키를 소스·원고·Actions 로그·채팅에 기록하지 않는다. 로컬 테스트는 가짜 자격 증명과 가짜 HTTP 응답만 사용하며 실제 Coupang API를 호출하지 않는다.

```js
import {CoupangPartnersClient} from './publishing/coupang-partners.mjs';

const client = new CoupangPartnersClient();
const candidates = await client.searchProducts('검색어');
// 후보를 직접 검토한 다음 선택한 Coupang URL만 변환한다.
const links = await client.createDeeplinks(['https://www.coupang.com/vp/products/...']);
```

GitHub 저장소의 **Settings → Secrets and variables → Actions**에서 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` 두 secret을 등록하면 API 인증 설정이 끝난다. 이후 Actions → `Coupang Partners API lookup` → Run workflow에서 `search` 또는 `deeplink`를 선택한다. 검색어 또는 Coupang 상품 URL(한 줄에 하나, 최대 3개)을 넣는다. workflow는 `tistory-publisher` self-hosted 러너에서 직렬 실행되고, 후보 조회·링크 변환 결과만 출력하며 게시물 파일을 바꾸지 않는다. 인증 키가 로그로 출력되지 않는 경로를 테스트했으며 실계정 인증은 키 등록 후 첫 실행으로 확인해야 한다.

로컬에서도 `node scripts/coupang-partners.mjs search "검색어"`, `node scripts/coupang-partners.mjs deeplink "https://www.coupang.com/vp/products/..."`로 실행할 수 있다. 로컬 PC와 self-hosted 러너는 호출 원장을 공유하지 않으므로 실제 운영에서는 한 실행 경로만 사용한다.

공식 [쿠팡 파트너스 API 가이드](https://partners.coupangcdn.com/partners-guide/partners-guide-20241216163254.pdf)의 검색 호출은 시간당 최대 10회, 기타 호출은 시간당 최대 100회로 제한한다. 이 구현은 공유 상태 파일에 요청 예약 시각을 원자적으로 기록하고, 한도를 넘으면 요청 전에 차단한다. 자동 재시도는 하지 않는다. 상태 파일은 작업 간 유지되는 로컬 디스크에 둔다. 일회성 CI 러너의 작업 디렉터리를 상태 파일 위치로 쓰면 작업 간 한도 보장이 되지 않으므로 금지한다.

## 게시물 적용 범위

- 한 글에 제휴 링크는 최대 3개이며 링크는 `https://link.coupang.com/` 도메인만 허용한다.
- 음식 글에서는 본문 주제와 직접 관련된 식재료·조리 도구·보관 용품만 허용한다. 의약품·건강기능식품·보충제·의료기기와 질병 치료·예방·체중 감량 등 건강 결과를 주장하는 상품명·선정 이유는 거부한다.
- 각 항목은 상품명, 변환된 URL, 허용 카테고리(`food`, `kitchen`, `storage`), 글과의 구체적 관련 이유가 필요하다. 작성자 검토가 끝나기 전에는 `reviewed: true`를 설정하지 않는다.
- 본문에서 상품을 효능·치료 효과의 근거로 소개하거나 구매를 권유하지 않는다. API 검색 결과는 후보일 뿐 품질·안전·재고·가격 보증이 아니다.
- 제휴 섹션은 자료 출처 앞에 표시하고, 공식 [운영 가이드의 고지 예시](https://partners.coupangcdn.com/partners-guide/partners-guide-20240711135620.pdf) 문구를 한 번 노출한다. 각 링크에 `rel="sponsored nofollow"`를 적용하며 공개 검증에서도 고지, 링크 수, 목적지와 속성을 확인한다. 검증에 실패하면 게시 완료로 처리하지 않는다.
- 제휴 상품을 선정하지 않은 게시물에는 광고 문구나 빈 제휴 섹션을 삽입하지 않는다.

## 남은 실계정 확인

현재 미완료인 외부 설정은 두 Actions secret 등록과 파트너스 API 사용 승인 여부 확인뿐이다. 등록 후 위 수동 workflow에서 검색 1회로 인증·응답을 확인한다. 그 실행은 티스토리에 글을 게시하거나 수정하지 않는다. API live-test는 아직 수행하지 않았다. 쿠팡 계정의 API 운영 승인 여부는 파트너스 계정에서 별도로 확인한다.

## 라이선스

HMAC 서명·요청 형식의 구현 참고에는 MIT 라이선스의 `n8n-nodes-coupang-partners`를 사용했다. 저작권 및 라이선스 고지는 `third-party/n8n-nodes-coupang-partners/LICENSE`에 보존한다. n8n 전용 패키지와 의존성은 가져오지 않았다.
