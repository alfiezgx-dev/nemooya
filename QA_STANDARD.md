# NEMO OYA release QA standard

Production branch: **main**
QA/development branch: **staging**

No visual release should be pushed directly to main.

## Asset integrity
- No base64/data-URI photographs.
- No photographic sprite sheets.
- Every referenced local image must exist and decode.
- Hero source must be at least 900 × 1100.
- Content sources must be at least 420 × 420.
- Photographic assets must render at >=1.5x source-pixel density relative to CSS width.
- Every <img> needs non-empty alt, width and height.

## Browser QA
Automated Playwright checks:
- Desktop 1440 × 1000, DPR 2
- Mobile 390 × 844, DPR 2

Release requires:
- zero broken images
- zero JS/page errors
- no horizontal overflow
- hero/content density >=1.5x
- masthead <=110 px desktop and <=64 px mobile
- full-page screenshots generated for visual review

## Typography
- English display uses Georgia/Times fallbacks.
- Chinese uses PingFang SC / Hiragino Sans GB / Microsoft YaHei / sans-serif.
- No novelty font may be the sole fallback.
- No clipped headings at test viewports.

## Visual review
Before production, verify screenshots show:
- central portrait visible and sharp
- category photography visible and not pixelated
- scrapbook/editorial density close to approved direction
- no accidental alt text
- category hierarchy is clear
- desktop and mobile both look intentional

## Production gate
Merge staging -> main only after:
1. automated QA is green
2. generated screenshots are visually reviewed
3. no known rendering defects remain
