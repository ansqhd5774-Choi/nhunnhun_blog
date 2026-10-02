# Apple cannibalization audit — /195 vs /356

Date: 2026-10-03

## Finding

Search-engine public results show an already indexed article:
- /195 — "사과(Apple)의 건강 효과와 영양 가치!! 알아두면 좋은 사실들!!"

New comprehensive article:
- /356 — "사과 효능·영양성분·부작용 총정리"

Both target substantially the same primary intent: 사과 효능 / 영양 / 부작용.

## Decision

Keep /356 as the primary comprehensive health/nutrition intent page.

Do not delete /195 without explicit user approval. Preserve URL equity.

When live post editing is available, rewrite /195 to a distinct intent:
- Primary intent: 사과 고르는 법·품종·보관법·활용법
- Remove overlapping "효능·영양·부작용" sections or reduce them to a short contextual paragraph.
- Add one contextual internal link to /356 for detailed 효능·영양·부작용.
- Remove/verify outdated or unsupported health claims.
- Review the external commercial link currently present in /195; do not preserve it automatically.

## Why

This preserves the indexed URL while reducing keyword cannibalization between /195 and /356.

## Live state

- /195 rewrite: NOT EXECUTED
- /356: published
- Search exact site query for /356: not yet observed in public search result at audit time
- GSC confirmation: unavailable because GSC Wizard subscription is inactive
