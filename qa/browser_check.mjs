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
    const h1 = document.querySelector('.mast h1');
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
      hasTwitterCard: !!document.querySelector('meta[name="twitter:card"][content="summary_large_image"]')
    };
  });

  for (const img of result.images) {
    if (img.visible && (!img.complete || img.naturalWidth === 0)) failures.push(`${t.name}: broken visible image ${D}{img.src}`);
  }
  if (result.overflow > 2) failures.push(`${t.name}: horizontal overflow ${D}{result.overflow}px`);
  if (t.name === 'desktop' && result.h1Font > 110) failures.push(`desktop: masthead too large (${D}{result.h1Font}px)`);
  if (t.name === 'mobile' && result.h1Font > 64) failures.push(`mobile: masthead too large (${D}{result.h1Font}px)`);
  if (result.heroRatio !== null && result.heroRatio < 1.5) failures.push(`${t.name}: hero image density ${D}{result.heroRatio.toFixed(2)}x < 1.5x`);
  if (result.heroFetchPriority !== 'high') failures.push(`${t.name}: hero image missing fetchpriority=high`);
  for (const [i, r] of result.contentRatios.entries()) {
    if (r < 1.5) failures.push(`${t.name}: content image #${D}{i + 1} density ${D}{r.toFixed(2)}x < 1.5x`);
  }
  if (result.draftsVisible) failures.push(`${t.name}: ${D}{result.draftsVisible} draft module(s) are visible`);
  if (/coming soon/i.test(result.bodyText)) failures.push(`${t.name}: visible "coming soon" copy found`);
  if (result.missingTargets.length) failures.push(`${t.name}: broken internal anchors: ${D}{result.missingTargets.join(', ')}`);
  if (result.duplicateSources.length) failures.push(`${t.name}: duplicate visible image sources: ${D}{JSON.stringify(result.duplicateSources)}`);
  if (result.belowFoldNonLazy.length) failures.push(`${t.name}: below-fold images missing lazy loading: ${D}{result.belowFoldNonLazy.join(', ')}`);
  if (!result.hasHeroPreload) failures.push(`${t.name}: hero preload missing`);
  if (!result.hasOgTitle || !result.hasOgDescription || !result.hasOgImage || !result.hasTwitterCard) failures.push(`${t.name}: social sharing metadata incomplete`);
  if (consoleErrors.length) failures.push(`${t.name}: console errors: ${D}{consoleErrors.join(' | ')}`);
  if (pageErrors.length) failures.push(`${t.name}: page errors: ${D}{pageErrors.join(' | ')}`);

  await page.screenshot({path:`qa-artifacts/${D}{t.name}.png`, fullPage:true});
  await browser.close();
}

if (failures.length) {
  console.error('\nBROWSER QA FAILED');
  failures.forEach(x => console.error(' -', x));
  process.exit(1);
}
console.log('BROWSER QA PASSED');
