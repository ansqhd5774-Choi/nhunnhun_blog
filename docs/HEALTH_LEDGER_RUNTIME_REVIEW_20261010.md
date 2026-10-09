# 공개 검증과 원장 후속 점검

## 적용 범위

읽기 전용 감사 도구에 이미지 브라우저 교차 확인을 추가했다. 이미지 주소 해시·확인 시점·실제 이미지 문서의 로딩 완료 및 자연 크기를 대조한다. HTTP 실패 기록은 삭제하지 않는다. 브라우저 로딩 성공을 사진 관련성이나 라이선스 검토 완료로 처리하지 않는다.

저장된 공개 글356개·출처889개·고유 이미지2209개의 기존 접근 관찰을 재사용했다. 새 전체 크롤링으로 표현하지 않는다. 자동 조회가 제한되거나 확인되지 않았던 이미지6개는 실제 브라우저에서 모두 로딩됐다. alt누락61곳과 전체 이미지 의미·라이선스 검토는 미완료다.

전체 로컬 회귀303/303 PASS. 공개 스킨이나 원고를 이 변경으로 수정하지 않았다.

## 새 제출 강조 검사 보완

계란 `/180`의 읽기 전용 실행 `37991576833`은 `E_DIRECT_PUBLIC_STYLE`로 실패했다. 실제 브라우저에서 형광펜 배경·노출·글 번호27px은 정상이고 중첩 strong은750으로 확인됐다. 실패 원인은 여러 단독 mark에 strong이 없다는 것이다. 사전 omission guard는 중첩1곳만 있으면 통과하지만 공개 검사는 모든 mark의 굵은 구조를 요구했다.

새 제출의 기존 `prepare-selected-source` 단계에 mark 전체의 중첩 구조 검사를 연결했다. 단독 mark·일부만 굵게 만든 mark는 `E_DIRECT_EMPHASIS_STRUCTURE`로 편집기 진입 전에 차단한다. 자동 태그 생성·문장 변경·개수 강제는 없으며 작성자가 한 번에 보완한다. 과거 읽기 전용 loader와 공개 검사의 assertion은 변경하지 않았다. 새 전체 회귀305/305 PASS; 앞선303개는 이전 변경 범위의 결과다. 이 코드 변경만으로 과거 `/180`을 수정 완료로 처리하지 않는다.

[PR129](https://github.com/ansqhd5774-Choi/nhunnhun_blog/pull/129)은 CI 통과 후 병합됐다. 이후 다른 작성자가 실행한 `/196` [37993573796](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37993573796)의 head `2382943a5713b6d19d8972acced5d2552ad017f7`에 새 검사 호출이 존재하고 선택 원고 준비 단계가 SUCCESS였다. 실제 원장은 `updated / PUBLIC_VERIFIED`다. 이는 새 검사 경로의 정상 원고 운영 증거이며 해당 원고 작성·제출을 이번 메인 작업자가 수행했다는 의미가 아니다. 잘못된 중첩 차단은 로컬 회귀 증거로 구분한다.

## 실제 운영 증거

- 홍합 `/400`: 읽기 전용 [37989170863](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37989170863) SUCCESS, 원장 `updated / PUBLIC_VERIFIED`.
- 봄동 `/404`: 관리자에서 기존 글 ID를 확인한 뒤 [37989292437](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37989292437) SUCCESS, 원장 `published / PUBLIC_VERIFIED`. 재발행하지 않았다.
- Bing `/282`: 공식 개별 URL 검사에서 기존 색인 성공 및 마지막 수집 2026-10-07 확인. 최신 수정 후 색인 요청을 정확히1회 제출해 `Indexing requested` 응답을 확인했다. 새로운 수집 완료는 미확인이다.
- Bing 사이트맵: 429/Unknown, 발견0. 사이트맵 오류와 개별 URL 색인 결과를 구분한다. 전체 URL의 색인 완료로 확대하지 않는다.

## 오류와 수정 필요 항목

- 닭고기 `/167`: [37990796691](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37990796691) `E_DIRECT_EMPHASIS_MISSING`. 과거 원고의 mark에 strong 중첩이 없어 현재 구조 검사를 통과하지 못했다. 공개 페이지 접근 실패가 아니다. 검사 우회·원장 해시 덮어쓰기 없이 원고 수정 필요로 유지한다.
- `/179`: [37991355605](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37991355605) `E_QA_ROOT / PUBLIC_VERIFICATION_MISMATCH`. 실제 공개 root는 과거 `nh-direct`이고 현재 검사는 `nh-direct-v2`를 요구했다. sourceCommit `7d7e470`의 당시 원고·당시 렌더러로 만든 텍스트와 현재 공개 본문의 텍스트가 공백 정규화 후 정확히 일치했다(1774자). 따라서 과거 본문 반영 PASS, 현재 버전 자동 구조 검사 FAIL로 분리한다. 이 텍스트 비교만으로 전체 이미지·모바일·강조 검사를 새로 완료했다고 쓰지 않는다. 저장 실패로 단정하거나 다시 제출하지 않는다.
- 오메가3 과거 신규 원고: `04d2ef274a1baf0f1093ed6451e1061dea1b30a3`에서 `/64` 수정 후 중복 신규 원고를 draft/미승인으로 퇴역시킨 이력을 확인했다. 오래된 submitting을 신규 발행 재시도 대상으로 삼지 않는다.
- `/356`, `/357`: 원장 생성 시점의 원고 해시는 일치한다. 이후 디자인 원고 변경으로 현재 해시가 달라진 역사적 불일치다. 과거 운영 검증을 취소하거나 현재 원장 해시를 임의로 바꾸지 않는다.
- `/237`: 실제 공개 제목의 Carvacrol과 본문의 카르바졸은 성분 정체성 대조가 필요한 혼용이다. [PubChem Carvacrol](https://pubchem.ncbi.nlm.nih.gov/compound/000010364)과 [Carbazole](https://pubchem.ncbi.nlm.nih.gov/compound/carbazole)은 다른 물질이다. 단순 이름 치환 대신 효능·섭취량·식품 함량 근거를 포함한 전체 재작성 필요로 기록한다.
- `/264`: 끊어진 PDF 출처 및 전체 근거 재검토는 아직 미완료다. 제품 상세 주소 보정 예외를 PDF 교체에 확대 적용하지 않는다.

- `/323`, `/269`: 현재 읽기 전용 실행은 각각 `E_QA_BODY`로 실패했다. sourceCommit 당시 렌더러로 만든 문구와 현재 공개 문구가 정확히 일치했다(`/323` 3313자, `/269` 2780자; 공백 정규화 및 style/script 제외). 이후 `0802706`의 SP1 H2 번호 추가가 현재 기대값에만 존재한다. 원문 미반영이 아니라 렌더 버전 차이이며 재제출하지 않는다. 과거 문구 반영 PASS와 현재 전체 자동 검증 FAIL을 분리한다. 이미지·의학 감수의 새 PASS 증거로 확대하지 않는다.

## 완료 판정

32개 항목은 완료21 / 미완료10 / 홍보 보류1을 유지한다. 후속 원장 배치 결과는 모든 실행이 종료된 뒤 별도 집계한다. 출처 내용·날짜·이미지 라이선스·전체 색인·성능의 미완료를 기술 검증 PASS로 대체하지 않는다.

독립 Ledger review 결과를 메인이 수집했다. 검증 SHA `b9c3120991a2952d88f6ee1d558526bd91bdbee1`에서 최초151건만 대조하면 published51 / updated78 / submitting21 / 역사적 failed1이다. 감사 중 다른 작성자가 추가한 원장을 섞지 않았다. 최초 submitting34 중 이번13건이 실제 공개 검증 후 최종 원장으로 회복됐다. 나머지21건은 이번 자동 FAIL8건, 퇴역 원고1건, 현재 source 없는 역사7건, 같은 URL 후속 원고가 있는 역사5건이다. 후속5건 중4건은 최신 원고 검증 성공, `/65` 후속은 실패다. 오래된 checkpoint를 삭제하거나 전부 성공으로 덮어쓰지 않았다.

## 19개 배치 종료와 원장 복구

19개 읽기 전용 배치는 최초10 SUCCESS /9 FAILURE로 모두 종료됐다. 망고 /358은 실제 PC·모바일 공개 검증 뒤 GitHub 원장 저장에서 E_UPDATE_LEDGER_REQUEST가 발생했다. HTTP 상태 로그가 없어 정확한 서버 오류·경합 원인은 확인 불가다. 이후 공식 Contents API가 정상 응답하고 원장 phase·URL·원고 해시가 그대로임을 확인한 뒤 읽기 전용 재검증을 정확히1회 실행했다. Run37994436004 SUCCESS, 원장 updated/PUBLIC_VERIFIED, PC·모바일 넘침0을 실제 확인했다. 티스토리 제출을 반복하지 않았다.

최종19개 고유 대상은11개 공개 검증·원장 복구 PASS /8개 현재 자동 검사 FAIL이다. 별도 /400·/404까지 포함하면21개 고유 대상 중13개 전체 공개 검증·원장 복구 PASS다.

8개 자동 FAIL의 해석:
- /167·/249·/252·/65: E_DIRECT_EMPHASIS_MISSING, 공개 검사 전 과거 원고 구조에서 차단됨. 공개 장애로 단정하지 않는다.
- /180: E_DIRECT_PUBLIC_STYLE, 일부 mark에 strong 중첩 없음. 강조 구조 수정 필요.
- /179·/323·/269: 새 렌더 버전과 과거 공개 구조/번호 차이. 당시 원고·당시 렌더러와 현재 공개 문구 일치 확인. 원문 반영 PASS이며 현재 전체 자동 검사와 구분한다. 재제출하지 않는다.

|sourceId|최종 읽기 전용 Run|Actions 결과|
|---|---|---|
|direct-399-ginkgo-pairing-20261009|[37989620276](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37989620276)|success|
|direct-333-peanut-butter-emphasis-20261009|[37989767651](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37989767651)|success|
|direct-299-hempseed-oil-20261009|[37989942425](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37989942425)|success|
|direct-337-lime-20261009|[37990325976](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37990325976)|success|
|direct-245-lemonade-20261009|[37990465212](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37990465212)|success|
|direct-146-garlic-20261009|[37990601240](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37990601240)|success|
|direct-167-chicken-20261009|[37990796691](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37990796691)|failure|
|direct-179-20261009|[37991355605](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37991355605)|failure|
|direct-180-timing2-20261009|[37991576833](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37991576833)|failure|
|direct-239-kimchi-emphasis-20261009|[37991855270](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37991855270)|success|
|direct-249-chili-20261009|[37992148687](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37992148687)|failure|
|direct-252-perilla-leaf-20261009|[37992361287](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37992361287)|failure|
|direct-310-granola-emphasis-20261009|[37993038449](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37993038449)|success|
|direct-321-melon-20261009|[37993257559](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37993257559)|success|
|direct-358-mango-20261009|[37994436004](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37994436004)|success (원장 복구)|
|direct-39-gum-emphasis-20261009|[37993570466](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37993570466)|success|
|direct-65-mackerel-links-20261009|[37993696169](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37993696169)|failure|
|auto-323-r55-20261008-e484c1f2|[37994033593](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37994033593)|failure|
|remove-credit-sections-269-20261008|[37994193320](https://github.com/ansqhd5774-Choi/nhunnhun_blog/actions/runs/37994193320)|failure|
