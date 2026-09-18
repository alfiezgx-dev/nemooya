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
    const images = [...document.images].map(img => ({
      src: img.getAttribute('src'),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      qa: img.dataset.qa || ''
    }));
    const h1 = document.querySelector('.mast h1');
    const hero = document.querySelector('[data-qa="hero"]');
    const content = [...document.querySelectorAll('[data-qa="content-image"]')];

    return {
      images,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1Font: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
      heroRatio: hero && hero.clientWidth ? hero.naturalWidth / hero.clientWidth : null,
      contentRatios: content.map(i => i.clientWidth ? i.naturalWidth / i.clientWidth : 0),
      bodyText: document.body.innerText
    };
  });

  for (const img of result.images) {
    if (!img.complete || img.naturalWidth === 0) failures.push(`${t.name}: broken image ${img.src}`);
  }
  if (result.overflow > 2) failures.push(`${t.name}: horizontal overflow ${result.overflow}px`);
  if (t.name === 'desktop' && result.h1Font > 110) failures.push(`desktop: masthead too large (${result.h1Font}px)`);
  if (t.name === 'mobile' && result.h1Font > 64) failures.push(`mobile: masthead too large (${result.h1Font}px)`);
  if (result.heroRatio !== null && result.heroRatio < 1.5) failures.push(`${t.name}: hero image density ${result.heroRatio.toFixed(2)}x < 1.5x`);
  for (const [i, r] of result.contentRatios.entries()) {
    if (r < 1.5) failures.push(`${t.name}: content image #${i + 1} density ${r.toFixed(2)}x < 1.5x`);
  }
  if (result.bodyText.includes('NEMO OYA creator portrait') && result.images.some(i => !i.complete || i.naturalWidth === 0)) {
    failures.push(`${t.name}: visible fallback/alt text risk`);
  }
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
console.log('BROWSER QA PASSED');
