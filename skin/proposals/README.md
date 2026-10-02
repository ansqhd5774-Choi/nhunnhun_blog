# 2026-10-03 SEO / A11Y R2 proposal

This directory contains a review candidate built from the sanitized reference skin.

## Files
- `skin/proposals/20261003-seo-a11y-r2.html`
- `css/proposals/20261003-seo-a11y-r2.css`

## Important
The HTML proposal contains the same redacted verification/ad identifiers as `skin/reference/skin.html`.
It is **not a deployable full skin file**.

For live application:
1. Fetch the latest live Tistory skin source.
2. Confirm it still matches the expected structural anchors.
3. Apply only the intended deltas from this proposal.
4. Preserve live verification tags, ad publisher IDs, Tistory placeholders, analytics and URL structure.
5. Validate PC / tablet / mobile and major routes after save.

## Intended deltas
- valid `<head>` structure and charset cleanup
- robots max-image-preview/snippet directives
- remove duplicate generic meta title/description from the skin
- Material Icons non-blocking stylesheet loading
- remove unused mainFont Google Fonts request
- system-font/render stability CSS
- search controls accessibility names and 48px targets
- Namecard/comment contrast and async layout reservation
- list/pagination ligature icon text replaced with inline SVG
- list summary markup fix
- invalid `<ui>` corrected to `<ul>`
- legacy external designer/footer attribution removed
- current blog title used in footer
- existing ad structure retained; only already-verified layout reservation CSS mirrored

## QA
`maintenance/validate-blog-source.mjs` validates these proposal files.
