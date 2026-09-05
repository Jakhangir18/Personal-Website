// Keyboard reachability + focus-visibility audit for the production preview.
// Usage: cd audit && node keyboard.mjs
import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:4322';
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 450; // let Lenis / CSS transitions settle after each Tab press

const SELECTOR = 'a[href], button, [tabindex]:not([tabindex="-1"]), input, select, textarea';

async function auditPage(browser, { reducedMotion } = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();

  const runErrors = [];
  page.on('pageerror', (e) => runErrors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') runErrors.push(`console.error: ${msg.text()}`);
  });

  await page.goto(URL, { waitUntil: 'load' });

  // The intro animation blocks scroll for ~5s via a class on <html>.
  try {
    await page.waitForFunction(
      () => !document.documentElement.classList.contains('is-scroll-blocked'),
      { timeout: 10000 },
    );
  } catch {
    runErrors.push('intro class "is-scroll-blocked" never cleared within 10s (fallback timeout used)');
    await page.waitForTimeout(6000);
  }
  await page.waitForTimeout(500); // small settle buffer

  // Tag every interactive element so we can match it back to activeElement.
  const elements = await page.evaluate((sel) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    return nodes.map((el, i) => {
      el.setAttribute('data-kbaudit-idx', String(i));
      const text = (el.innerText || el.value || el.getAttribute('aria-label') || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 50);
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // "hidden" here means truly removed from the a11y/focus tree
      // (display:none or visibility:hidden) - NOT small/zero-size boxes,
      // which can still be real, focusable, but visually invisible bugs.
      const hidden = cs.display === 'none' || cs.visibility === 'hidden';
      return {
        idx: i,
        tag: el.tagName.toLowerCase(),
        text,
        href: el.getAttribute('href') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        disabled: !!el.disabled,
        visible: !hidden,
        zeroSize: rect.width === 0 || rect.height === 0,
      };
    });
  }, SELECTOR);

  const total = elements.length;
  const reached = new Map(); // idx -> focus info (first-seen)
  const maxPresses = total + 20;

  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(SETTLE_MS);
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const idxAttr = el.getAttribute('data-kbaudit-idx');
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const inViewport =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);
      const outlineStyle = cs.outlineStyle;
      const outlineWidth = cs.outlineWidth;
      const boxShadow = cs.boxShadow;
      const hasOutline = outlineStyle !== 'none' && outlineWidth !== '0px';
      const hasBoxShadow = !!boxShadow && boxShadow !== 'none' && !/^rgba\(0, 0, 0, 0\)/.test(boxShadow);
      return {
        idx: idxAttr !== null ? Number(idxAttr) : null,
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 50),
        outlineStyle,
        outlineWidth,
        boxShadow,
        focusVisible: hasOutline || hasBoxShadow,
        inViewport,
      };
    });
    if (info && info.idx !== null && !reached.has(info.idx)) {
      reached.set(info.idx, info);
    }
  }

  await context.close();
  return { elements, reached, runErrors };
}

function summarize(result, label) {
  const { elements, reached, runErrors } = result;
  const visibleElements = elements.filter((e) => e.visible);
  const total = visibleElements.length;
  const reachedList = visibleElements.filter((e) => reached.has(e.idx));
  const focusVisibleList = reachedList.filter((e) => reached.get(e.idx).focusVisible);
  const scrolledList = reachedList.filter((e) => reached.get(e.idx).inViewport);

  const unreached = visibleElements.filter((e) => !reached.has(e.idx));
  const focusInvisible = reachedList.filter((e) => !reached.get(e.idx).focusVisible);
  const notScrolled = reachedList.filter((e) => !reached.get(e.idx).inViewport);

  console.log(`\n=== ${label} ===`);
  console.log(
    `Total interactive (visible): ${total} | Reached: ${reachedList.length} | Focus-visible: ${focusVisibleList.length} | Scrolled-into-view: ${scrolledList.length}`,
  );
  console.log(`(hidden/off-canvas elements found in DOM but excluded from total: ${elements.length - total})`);

  const zeroSizeCount = visibleElements.filter((e) => e.zeroSize).length;
  if (zeroSizeCount) console.log(`Zero-size boxes among visible elements (width or height = 0): ${zeroSizeCount}`);

  if (unreached.length) {
    console.log(`Unreached (${unreached.length}):`);
    for (const e of unreached) console.log(`  [${e.tag}]${e.zeroSize ? '[0-size]' : ''} "${e.text}" href=${e.href}`);
  }
  if (focusInvisible.length) {
    console.log(`Focus-invisible (${focusInvisible.length}):`);
    for (const e of focusInvisible) console.log(`  [${e.tag}]${e.zeroSize ? '[0-size]' : ''} "${e.text}" href=${e.href}`);
  }
  if (notScrolled.length) {
    console.log(`Not scrolled into view on focus (${notScrolled.length}):`);
    for (const e of notScrolled) console.log(`  [${e.tag}]${e.zeroSize ? '[0-size]' : ''} "${e.text}" href=${e.href}`);
  }
  if (runErrors.length) {
    console.log(`Run errors (${runErrors.length}):`);
    for (const e of runErrors) console.log(`  ${e}`);
  }
  return { total, reached: reachedList.length, focusVisible: focusVisibleList.length, scrolled: scrolledList.length };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const normal = await auditPage(browser, { reducedMotion: false });
    summarize(normal, 'normal motion');

    const reduced = await auditPage(browser, { reducedMotion: true });
    summarize(reduced, 'prefers-reduced-motion: reduce');
  } catch (err) {
    console.error('FATAL:', err && err.stack ? err.stack : err);
    process.exitCode = 0; // still exit 0 per spec, error is printed
  } finally {
    await browser.close();
  }
})();
