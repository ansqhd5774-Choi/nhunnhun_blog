# Tistory Performance R1 — 2026-10-02

대상: https://nhunnhun.tistory.com/356

## 측정 기준
- Mobile Performance 34
- Mobile LCP 10.9~12.2s
- Mobile CLS 0.583~0.624
- Desktop Performance 62
- Desktop LCP 2.3s
- Desktop CLS 0.361
- LCP 요소: 붉은 사과 대표 이미지
- 대표 이미지 원본: 2790x1758 / 약 495.7KiB
- 렌더 차단 추정 절감: 약 4.18s
- Hahmlet/Material Icons 웹폰트가 CLS 원인 중 하나

## R1 변경 범위
1. 운영 스킨의 mainFont Google Fonts 링크 제거
2. 본문/입력 UI 폰트를 시스템 폰트 스택으로 고정
3. #content opacity:0 + fade-in 제거
4. 기존 이미지 반응형 규칙 유지
5. /356 대표 사과 이미지를 Wikimedia 720px thumbnail로 교체
6. 대표 이미지 width/height=720x454, eager + fetchpriority=high
7. 본문 사과 이미지를 720px thumbnail로 교체, width/height=720x480, lazy
8. 실패 시 같은 실행 안에서 글/스킨 원복

## 제외
- AdSense 제거/지연
- Kakao SDK 제거/지연
- Tistory 플랫폼 JS 수정
- 카테고리/푸터/목록/SEO description 수정

R1 적용 후 PageSpeed 재측정 결과를 기준으로 R2 범위를 결정한다.
