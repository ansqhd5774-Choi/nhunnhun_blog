# 질문 모듈 목록 R1

모듈은 소제목 개수 규정이 아니다. 관련 질문을 한 섹션에서 함께 설명하고 실제 답변·출처를 연결한다. Core는 필수, 확장은 적용 검토 후 선택한다.

| ID | 독자에게 답할 내용 | Core 적용 분야 |
| --- | --- | --- |
| identity | 정체·종류·이름의 의미 | food, nutrient, medicine, disease |
| role | 몸에서 하는 역할을 쉽게 설명 | nutrient |
| nutrition | 식품 영양성분·가식부·1회분 기준 | food |
| benefits | 기대할 수 있는 도움과 건강상 의미 | food, nutrient |
| audience | 고려할 사람·불필요한 사람 | nutrient, medicine |
| expectations | 효과 크기·근거·현실적인 기대 | nutrient |
| amount | 섭취량·용량·단위·대상·상한의 구분 | food, nutrient, medicine |
| use | 먹거나 사용하는 방법·시점·경로 | nutrient, medicine |
| preparation | 조리·실제 식사 활용 | food |
| storage | 보관·변질·폐기 기준 | food, medicine |
| selection | 주제에 맞는 선택 기준 | food, nutrient |
| safety | 흔한 문제와 중요한 위해 | food, nutrient, medicine |
| decision | 독자가 지금 할 수 있는 선택·다음 행동 | food, nutrient, medicine, disease |
| indications | 허가된 효능·적응증과 한계 | medicine |
| contraindications | 금기·주의 대상 | medicine |
| interactions | 약·음식·영양제의 상호작용·중복 | nutrient, medicine |
| symptoms | 주요 증상·발현 양상 | disease |
| causes | 원인 | disease |
| risk | 위험요인 | disease |
| self_check | 자가 점검의 범위·확진과의 차이 | disease |
| diagnosis | 검사·감별·진단 과정 | disease |
| treatment | 표준치료와 선택지 | disease |
| home_care | 집에서 할 수 있는 안전한 관리 | disease |
| red_flags | 응급 위험신호와 즉시 할 행동 | disease |
| medical_help | 진료 시점·진료과·약사 상담 | medicine, disease |
| timeline | 효과 시작·관찰기간·개인차 | medicine |
| long_term | 꾸준한 사용·연구기간·장기 안전성·재평가 | 조건부 |
| stopping | 중단 후 변화·의료진과 조정할 경우 | 조건부 |
| comparison | 같은 목적·기준으로 비교 | 조건부 |
| alternatives | 대체 가능한 것과 불가능한 것 | 조건부 |
| combinations | 추가하면 도움이 되는 조합과 단순 병용 가능의 구분 | 조건부 |
| product_variants | 성분·제형·실함량·마케팅 차이 | 조건부 |
| food_sources | 식품 공급원·보충제 대체 범위 | 조건부 |
| deficiency | 결핍 위험·확인 방법 | 조건부 |
| cultivars | 품종별 맛·식감·용도 | 조건부 |
| origins | 산지·재배환경·품종·생산연도의 구분 | 조건부 |
| seasonality | 품종·산지별 제철 | 조건부 |
| cost | 동일 기준 1일·1회 비용 및 가격 확인일 | 조건부 |
| folk_remedies | 민간요법의 도움·한계·위험·표준치료와 관계 | 조건부 |
| exercise | 운동·회복과의 관계 | 조건부 |
| diet | 함께 먹을 음식·식단·피할 식품 | 조건부 |
| vulnerable_groups | 어린이·고령자·임신·수유·질환별 차이 | 조건부 |
| missed_dose | 복용을 잊거나 더 먹었을 때의 공식 안내 | 조건부 |
| myths | 실제 검색되는 오해를 짧게 풀이 | 조건부 |
| latest | 새 정보로 달라진 판단과 확인일 | 조건부 |
| follow_up | 효과·이상반응 관찰·재검·진료 전환 | 조건부 |

## 매 글에서 적용 여부와 이유를 기록할 확장

| 확장 ID | 적용 시 요구되는 질문 |
| --- | --- |
| longTerm | timeline, long_term, follow_up |
| comparison | comparison, alternatives |
| combinations | combinations, interactions |
| products | product_variants, selection |
| foodReplacement | food_sources, alternatives |
| essentialNutrient | deficiency, food_sources |
| cultivars | cultivars |
| origins | origins |
| seasonality | seasonality |
| cost | cost |
| folkRemedies | folk_remedies |
| selfCheck | self_check, medical_help |
| exercise | exercise |
| diet | diet |
| vulnerableGroups | vulnerable_groups |
| discontinuation | stopping |
| missedDose | missed_dose |
| myths | myths |
| latest | latest |

알려진 종합 안내 프로필은 `publishing/standards/common.mjs`의 TOPIC_EXTENSIONS를 따른다. 새 프로필·모듈 변경 시 이 목록과 테스트를 함께 갱신한다. 모든 false 또는 무의미한 이유로 범위를 줄이지 않는다. 관련 없다고 검토한 질문을 본문에 억지로 작성하지도 않는다.
