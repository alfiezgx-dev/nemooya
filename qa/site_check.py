from pathlib import Path
import re, sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
TEMPLATES = [ROOT / "recipe-template.html", ROOT / "cocktail-template.html"]
errors = []

def fail(msg):
    errors.append(msg)

if not HTML.exists():
    fail("index.html is missing")
else:
    text = HTML.read_text(encoding="utf-8")
    required_tokens = [
        '<meta name="viewport"', '<meta name="description"', '<link rel="canonical"',
        '<link rel="preload" as="image" href="/assets/hero.webp"',
        '<meta property="og:title"', '<meta property="og:description"', '<meta property="og:image"',
        '<meta property="og:type"', '<meta name="twitter:card" content="summary_large_image"',
        '<title>', 'lang="en"', '[data-status="draft"]'
    ]
    for token in required_tokens:
        if token not in text:
            fail(f"Missing required HTML token: {token}")

    if "data:image/" in text:
        fail("Embedded data:image assets are not allowed.")
    if "content-sprite" in text.lower():
        fail("Photographic sprite sheets are not allowed.")

    refs = set()
    for m in re.finditer(r'(?:src|href)=["\']([^"\']+)["\']', text):
        ref = m.group(1).strip()
        if ref and not ref.startswith(("http://", "https://", "#", "mailto:", "javascript:")):
            if ref.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg")):
                refs.add(ref.lstrip("/"))

    for ref in sorted(refs):
        p = ROOT / ref
        if not p.exists():
            fail(f"Referenced asset does not exist: {ref}")
            continue
        if p.stat().st_size < 1024:
            fail(f"Asset suspiciously small (<1KB): {ref}")
            continue
        try:
            with Image.open(p) as im:
                im.verify()
            with Image.open(p) as im:
                w, h = im.size
            if p.name == "hero.webp":
                if w < 900 or h < 1100:
                    fail(f"Hero image too small: {ref} is {w}x{h}; require >=900x1100")
            else:
                if w < 420 or h < 420:
                    fail(f"Content image too small: {ref} is {w}x{h}; require >=420x420")
        except Exception as e:
            fail(f"Invalid image file {ref}: {e}")

    for tag in re.findall(r'<img\b[^>]*>', text, flags=re.I):
        if not re.search(r'\balt=["\'][^"\']+["\']', tag, flags=re.I):
            fail(f"Image missing non-empty alt attribute: {tag[:140]}")
        if not re.search(r'\bwidth=["\']?\d+', tag, flags=re.I):
            fail(f"Image missing width attribute: {tag[:140]}")
        if not re.search(r'\bheight=["\']?\d+', tag, flags=re.I):
            fail(f"Image missing height attribute: {tag[:140]}")

for template in TEMPLATES:
    if not template.exists():
        fail(f"Missing content template: {template.name}")
        continue
    t = template.read_text(encoding="utf-8")
    for token in ("<article", "<h1", 'class="ingredients"', 'class="steps"', 'name="robots" content="noindex"'):
        if token not in t:
            fail(f"{template.name} missing semantic template token: {token}")

if errors:
    print("\nSITE QA FAILED")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("SITE QA PASSED")
