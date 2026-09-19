import { chromium } from 'playwright';
import fs from 'node:fs';

const targets = [
  {name:'desktop', width:1440, height:1000},
  {name:'mobile', width:390, height:844},
];

fs.mkdirSync('qa-artifacts', {recursive:true});
const failures = [];

for (const t of targets) {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:t.width,height:t.height}, deviceScaleFactor:2});
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));

  await page.goto('http://127.0.0.1:4173', {waitUntil:'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const step = Math.max(500, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 70));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(() => {
    const visible = el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const images = [...document.images].map(img => ({
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      loading: img.getAttribute('loading') || '',
      fetchpriority: img.getAttribute('fetchpriority') || '',
      top: img.getBoundingClientRect().top,
      visible: visible(img),
      qa: img.dataset.qa || ''
    }));
    const visibleImages = images.filter(i => i.visible);
    const h1 = document.querySelector('.hero-title');
    const hero = document.querySelector('[data-qa="hero"]');
    const content = [...document.querySelectorAll('[data-qa="content-image"]')].filter(visible);
    const drafts = [...document.querySelectorAll('[data-status="draft"]')];
    const internalLinks = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'));
    const missingTargets = internalLinks.filter(href => href && href !== '#' && !document.querySelector(href));
    const duplicateSources = Object.entries(visibleImages.reduce((acc, i) => {
      acc[i.src] = (acc[i.src] || 0) + 1;
      return acc;
    }, {})).filter(([,count]) => count > 1);
    const belowFoldNonLazy = images.filter(i =>
      i.visible && i.qa !== 'hero' && i.top > window.innerHeight * 0.9 && i.loading !== 'lazy'
    ).map(i => i.src);

    return {
      images,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1Font: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
      heroRatio: hero && hero.clientWidth ? hero.naturalWidth / hero.clientWidth : null,
      heroFetchPriority: hero ? hero.getAttribute('fetchpriority') : null,
      contentRatios: content.map(i => i.naturalWidth / i.clientWidth),
      bodyText: document.body.innerText,
      draftsVisible: drafts.filter(visible).length,
      missingTargets,
      duplicateSources,
      belowFoldNonLazy,
      hasHeroPreload: !!document.querySelector('link[rel="preload"][as="image"][href="/assets/hero.webp"]'),
      hasOgTitle: !!document.querySelector('meta[property="og:title"]'),
      hasOgDescription: !!document.querySelector('meta[property="og:description"]'),
      hasOgImage: !!document.querySelector('meta[property="og:image"]'),
      hasTwitterCard: !!document.querySelector('meta[name="twitter:card"][content="summary_large_image"]'),
      heroWidth: document.querySelector('.hero-editorial')?.getBoundingClientRect().width || null,
      exploreWidth: document.querySelector('#explore')?.getBoundingClientRect().width || null,
      heroHeight: document.querySelector('.hero-editorial')?.getBoundingClientRect().height || null
    };
  });

  for (const img of result.images) {
    if (img.visible && (!img.complete || img.naturalWidth === 0)) failures.push(`${t.name}: broken visible image ${img.src}`);
  }
  if (result.overflow > 2) failures.push(`${t.name}: horizontal overflow ${result.overflow}px`);
  if (t.name === 'desktop' && result.h1Font > 66) failures.push(`desktop: hero title too large (${result.h1Font}px)`);
  if (t.name === 'mobile' && result.h1Font > 60) failures.push(`mobile: hero title too large (${result.h1Font}px)`);
  if (t.name === 'desktop' && result.heroWidth !== null && result.exploreWidth !== null && Math.abs(result.heroWidth - result.exploreWidth) > 3) failures.push(`desktop: hero width ${result.heroWidth.toFixed(1)}px does not align with content width ${result.exploreWidth.toFixed(1)}px`);
  if (t.name === 'desktop' && result.heroHeight !== null && result.heroHeight > 590) failures.push(`desktop: hero too tall (${result.heroHeight.toFixed(0)}px > 590px)`);
  if (result.heroRatio !== null && result.heroRatio < 1.5) failures.push(`${t.name}: hero image density ${result.heroRatio.toFixed(2)}x < 1.5x`);
  if (result.heroFetchPriority !== 'high') failures.push(`${t.name}: hero image missing fetchpriority=high`);
  for (const [i, r] of result.contentRatios.entries()) {
    if (r < 1.5) failures.push(`${t.name}: content image #${i + 1} density ${r.toFixed(2)}x < 1.5x`);
  }
  if (result.draftsVisible) failures.push(`${t.name}: ${result.draftsVisible} draft module(s) are visible`);
  if (/coming soon/i.test(result.bodyText)) failures.push(`${t.name}: visible "coming soon" copy found`);
  if (result.missingTargets.length) failures.push(`${t.name}: broken internal anchors: ${result.missingTargets.join(', ')}`);
  if (result.duplicateSources.length) failures.push(`${t.name}: duplicate visible image sources: ${JSON.stringify(result.duplicateSources)}`);
  if (result.belowFoldNonLazy.length) failures.push(`${t.name}: below-fold images missing lazy loading: ${result.belowFoldNonLazy.join(', ')}`);
  if (!result.hasHeroPreload) failures.push(`${t.name}: hero preload missing`);
  if (!result.hasOgTitle || !result.hasOgDescription || !result.hasOgImage || !result.hasTwitterCard) failures.push(`${t.name}: social sharing metadata incomplete`);
  if (consoleErrors.length) failures.push(`${t.name}: console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`${t.name}: page errors: ${pageErrors.join(' | ')}`);

  await page.screenshot({path:`qa-artifacts/${t.name}.png`, fullPage:true});
  await browser.close();
}

if (failures.length) {
  console.error('\nBROWSER QA FAILED');
  failures.forEach(x => console.error(' -', x));
  process.exit(1);
}
for (const t of targets) {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:t.width,height:t.height}, deviceScaleFactor:2});
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/ai-lab.html', {waitUntil:'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    hasTitle: document.title === 'NEMO AI LAB',
    hasGrid: !!document.querySelector('.lab-grid'),
    cardCount: document.querySelectorAll('.lab-grid .card').length,
    hasHome: !!document.querySelector('a[href="index.html"]')
  }));
  if (result.overflow > 2) failures.push(`${t.name}: AI Lab horizontal overflow ${result.overflow}px`);
  if (!result.hasTitle || !result.hasGrid || result.cardCount < 4 || !result.hasHome) failures.push(`${t.name}: AI Lab structure incomplete`);
  if (consoleErrors.length) failures.push(`${t.name}: AI Lab console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`${t.name}: AI Lab page errors: ${pageErrors.join(' | ')}`);
  await page.screenshot({path:`qa-artifacts/${t.name}-ai-lab.png`, fullPage:true});
  await browser.close();
}
if (failures.length) {
  console.error('\nBROWSER QA FAILED AFTER AI LAB CHECK');
  failures.forEach(x => console.error(' -', x));
  process.exit(1);
}
console.log('BROWSER QA PASSED');
