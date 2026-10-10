# 기존 3개 글 정체성 최소 교정 후보

기준 작업 트리: `health-native-text-surgical-20261010`, base `2affc54`. 원격 변경 및 실제 제출 없음.

## 구현

- 기존 `update-posts` 경로에 `native-text-surgical-v1` 조건 원고를 연결했다. 승인 대상은 `/236`, `/233`, `/200`만 허용한다.
- 원고에는 원문 HTML·이미지 주소·대표 이미지 주소를 넣지 않는다. 실제 편집기의 원문 전체 SHA256, 원래 제목·메타 SHA256, 원문 공개 텍스트 SHA256, 개별 텍스트 노드 offset/length/hash와 새 문장만 기록한다.
- 사진 매크로와 속성, 링크, style 및 나머지 원문 byte를 보존하고 모든 변경을 역복원하면 원본과 byte 단위로 같아야 한다. 이미지 순서는 공개 asset의 유일한 대응으로 검증한다.
- 익명 PC/모바일 기준에서 제목·대표·태그·카테고리 및 이미지 자산/alt/로딩을 대조한다. 제출 후 전체 공개 텍스트와 텍스트 외 DOM 구조·속성 hash, 메타정보, 이미지 보존 및 overflow를 확인한다.
- 원장 `submitting`을 먼저 기록하고 최종 제출은 1회만 실행한다. 재검증은 편집기를 열지 않는 기존 finalizer 경로를 사용한다.

## 후보 및 검증

세 조건 파일은 모두 `draft / approved:false`다. 실행 승인 상태로 저장하지 않았다. 메모리에서만 검토용 승인 사본의 계약을 검사했다.

| URL | 새 제목 범위 | 텍스트 slot | 기존 이미지 | 교정 범위 |
|---|---|---:|---:|---|
| /236 | 티몰·티민·티아민 차이, 성분명·용도 | 754 | 8 | DNA·비타민 B1·섭취량·함량·시너지·가상 제품 설명의 의존 절 교정 |
| /233 | 1,8-시네올·유칼립톨, 제품 확인 | 636 | 9 | 카로티노이드·비타민 A/B3·일일량·함량표·효능·가상 제품 설명 교정 |
| /200 | 스피루리나 원료·영양, 클로렐라와 차이 | 57 | 11 | 녹조류/남세균 혼동 및 단정적 기원 문장 교정 |

slot 수는 원래 HTML의 span/엔티티 분할에 따른 텍스트 노드 수이며 독립 주장 수가 아니다. /236·/233에는 틀린 설명이 여러 섹션에 전파되어 의존 설명을 함께 제거했다.

계약 적용·역복원·매크로의 비caption byte 보존 3건 PASS. 전체 로컬 `node --test tests/*.test.mjs` **488 PASS**, 실제 Production 미실행. body/metadata/asset/slot/target hash 불일치, 속성 패치, 범위 밖 article, 매크로 주입, 중복 submit, 제출 실패 후 원장 보존 회귀를 포함한다.

## 중요 제한

- 읽어온 native 원문은 숨겨진 textarea 기준이다. 런너 HTML 모드의 실제 문자열이 다르면 정확한 hash gate에서 중단해야 한다. 실제 해당 모드에서 읽기 전용 재수집한 후 조건을 다시 준비하며 gate를 완화하지 않는다.
- 사진 자산과 이미지 alt를 보존한다. `/236`의 확정 이름 오류 caption `티민(Thymol)`만 `티몰(Thymol)` 한 JSON 토큰으로 바꾸는 조건을 추가했다. 나머지 과거 영양소 사진은 비교·성분 구분 문맥으로 설명하며 실제 이미지 교체·권리 감수 완료가 아니다.
- 새로 빈 p/li37개 및 빈 목록3개(`/236`), 새로 빈 p/li40개 및 빈 목록2개(`/233`)는 정확 wrapper 태그만 span으로 바꾸었다. 모든 자식 span·속성·inline style과 원래 빈 p16개를 보존한다. 실제 가독성 Runtime PASS는 아직 아니다.
- /200의 나머지 체중·B12·질병 주장 전체에 대한 임상 감수가 아니다.
- `/200` HTML mode 실제 읽기는 부모의 브라우저 자동화 timeout으로 아직 확인되지 않았다. 기능 실패가 아니라 관측 제약이며 hidden textarea hash를 임의로 완화하지 않는다.

## 공개 target 구조 대응

이미지 src의 signed transport query만 기존 publicAssetIdentity로 정규화한다. 다른 asset·alt·width·style·비image URL 변화는 회귀 검사에서 불허한다.

실제 읽기 전용 provider 본문에서 `/236` 비어있지 않은 native block61개, `/233`63개가 각각 tag+정규화 텍스트로 유일하게 대응했다. 빈 노드는 인접한 유일 비어있지 않은 block의 경계, 태그·전체 속성·빈 노드 개수를 함께 확인해 대응한다. ordinal만으로 매칭하지 않는다.

변경되는 block은 자식 태그와 모든 속성, element 경계 사이의 텍스트 run을 원본/교정본/provider 사이에 엄격하게 대조한다. entity 직렬화가 텍스트 노드를 나누어도 같은 element 경계의 실제 텍스트가 같아야 한다. 이 대응으로만 예상 target 구조 hash를 계산하고 전체 예상 공개 텍스트 hash가 원고 target과 일치해야 한다. `/236` 대응 block77개, `/233`79개로 target 계산 PASS. 제목·사진 자체의 Runtime 완료 판정은 아니다.

## 교정 근거

- [PubChem Thymol](https://pubchem.ncbi.nlm.nih.gov/compound/6989): 티몰의 화학적 정체성.
- [NHGRI Thymine](https://www.genome.gov/genetics-glossary/Thymine): DNA 염기 티민의 정체성.
- [NIH ODS Thiamin](https://ods.od.nih.gov/factsheets/Thiamin-HealthProfessional/): 비타민 B1 티아민과 섭취 기준.
- [PubChem 1,8-Cineole](https://pubchem.ncbi.nlm.nih.gov/compound/1_8-Cineole): 유칼립톨의 정체성.
- [NIH ODS Vitamin A](https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/): 비타민 A 전구체의 구분.
- [NIH LiverTox Spirulina](https://www.ncbi.nlm.nih.gov/books/NBK548312/?report=printable): 스피루리나 원료.
- [NCBI Chlorella taxonomy](https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=3071&mode=Info): 클로렐라 녹조류 분류.

일부 공식 페이지의 현재 직접 조회는 캡차 제한이 있었으며 공식 검색 결과와 실제 읽힌 NHGRI/ODS/NCBI 내용으로 기초 정체성을 대조했다. 완제품 임상 효능을 새로 추가하지 않았다.
