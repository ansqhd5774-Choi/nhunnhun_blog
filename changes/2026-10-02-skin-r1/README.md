# Tistory Skin R1 Foundation Fix — 2026-10-02

대상: https://nhunnhun.tistory.com/
상태: APPLIED / PUBLIC VERIFIED

## 목적
기존 디자인을 변경하지 않고 공통 기반 오류만 수정한다.

## 적용 범위
- 키보드 focus-visible outline 복구
- #content 기본 opacity 1로 JS 실패 시 본문 숨김 방지
- 본문 이미지/figure가 콘텐츠 폭을 넘지 않도록 반응형 제한
- 개별 게시글의 더 작은 max-width 지정은 유지
- 본문 UL/OL marker 복구
- 본문 링크 underline 복구 및 hover font-weight 변화 제거
- 본문 긴 문자열 overflow 방지
- 모바일 600px 이하 표 horizontal scroll 허용

## 운영 CSS 증거
- R1 최초 적용 전 SHA256: 29869e30e3315fc7b38feaffc2d2ef92d026efbb45d5c4ef8c4c00afd55884a4
- R1 최초 적용 SHA256: 1a5a2431a55fb1bce282c7f966d2b2c9a43a6a33d9ebdb8d52d51864257375e5
- R1 최종 보정 SHA256: 253c2fd307ef7ca8463aa0894fd206a3051cf3c4e6955550b98affd66fc288ea
- 변경 블록 marker: NHUNNHUN_SKIN_R1_FOUNDATION_20261002

## 공개 검증
PC 1440x900:
- 본문 폭 810px
- 사과 이미지 720x454, 720x480
- UL disc / OL decimal
- 본문 링크 underline
- 표 display table
- #content opacity 1
- horizontal overflow 없음

Mobile 390x844:
- 본문 폭 350px
- 사과 이미지 350x221, 350x233
- UL disc / OL decimal
- 본문 링크 underline
- 표 display block + horizontal overflow
- #content opacity 1
- horizontal overflow 없음

## 롤백
운영 CSS에서 아래 marker 사이의 블록만 제거하고 적용한다.
- 시작: /* NHUNNHUN_SKIN_R1_FOUNDATION_20261002 */
- 종료: /* /NHUNNHUN_SKIN_R1_FOUNDATION_20261002 */

R1 외 기존 CSS는 변경하지 않는다.
