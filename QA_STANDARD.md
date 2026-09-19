# NEMO OYA release QA standard

Production branch: **main**
QA/development branch: **staging**

No visual release should be pushed directly to main.

## Asset integrity
- Current hero production asset is derived directly from the original 1278×1700 uploaded selfie and exported at 1000×1330 WebP quality 92.
- No base64/data-URI photographs.
- No photographic sprite sheets.
- Every referenced local image must exist and decode.
- Hero source must be at least 900 × 1100.
- Content sources must be at least 420 × 420.
- Photographic assets must render at >=1.5x source-pixel density relative to CSS width.
- Every <img> needs non-empty alt, width and height.
- Live semantic modules must not reuse the same image source for unrelated content. Use a semantic placeholder until a dedicated asset exists.

## Content truthfulness
- Unfinished modules use data-status="draft" and must be hidden in production.
- No visible "coming soon" copy.
- No fake social-media feed or non-functional newsletter form may be shown.
- Instagram uses a direct follow CTA until a real embed/widget is connected.

## Performance & sharing
- Hero image is preloaded and uses fetchpriority="high".
- Visible below-fold images use loading="lazy".
- Open Graph and Twitter card metadata are required.
- Internal navigation anchors must resolve.
- Reduced-motion preferences must be respected.

## Browser QA
Automated Playwright checks:
- Desktop 1440 × 1000, DPR 2
- Mobile 390 × 844, DPR 2

Release requires:
- zero broken visible images
- zero JS/page errors
- no horizontal overflow
- hero/content density >=1.5x
- no visible draft modules
- no duplicate live image sources
- no broken internal anchors
- masthead <=110 px desktop and <=64 px mobile
- full-page screenshots generated for visual review

## Typography
- English display uses Georgia/Times fallbacks.
- Chinese uses PingFang SC / Hiragino Sans GB / Microsoft YaHei / sans-serif.
- No novelty font may be the sole fallback.
- Brand colors, font stacks, radii and core spacing live in :root custom properties.
- No clipped headings at test viewports.

## Content templates
- recipe-template.html and cocktail-template.html must exist.
- Templates are noindex until copied into real published pages.
- Recipe/cocktail pages use semantic article, h1, ingredients and ordered steps structures.

## Visual review
Before production, verify screenshots show:
- central portrait visible and sharp
- category photography visible and not pixelated
- no fake/repeated image grid
- no accidental alt text
- category hierarchy is clear
- desktop and mobile both look intentional

## Production gate
Merge staging -> main only after:
1. automated QA is green
2. generated screenshots are visually reviewed
3. no known rendering defects remain
