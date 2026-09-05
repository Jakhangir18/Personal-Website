#!/usr/bin/env node
// Repeatable browser measurement harness for the site's scroll performance.
//
// Usage:
//   node measure.mjs --browser chromium|webkit --url http://127.0.0.1:4321
//
// For each of two viewports (desktop 1440x900 dsf=2, mobile 390x844 isMobile/hasTouch)
// this script:
//   - collects console errors/warnings and failed/404 network requests
//   - scrolls the full page top->bottom->top over ~8s using wheel events
//     (Lenis intercepts wheel; window.scrollTo bypasses Lenis smoothing)
//     while an injected rAF counter + PerformanceObserver record FPS/longtasks
//   - repeats the scroll measurement restricted to the #work section
//   - saves screenshots at 0/25/50/75/100% of page height
//   - runs axe-core and reports critical/serious violations
//   - writes everything to audit/out/<browser>-<viewport>.json
//
// NOTE: this runs headless on a 4-core VPS with no GPU. The FPS/longtask
// numbers are a *relative* baseline for comparing before/after a change on
// this same machine - they are not representative of real user-perceived
// FPS on a GPU-accelerated, non-headless browser.

import { chromium, webkit, firefox } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseArgs(argv) {
  const args = { browser: 'chromium', url: 'http://127.0.0.1:4321' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--browser') args.browser = argv[++i];
    else if (argv[i] === '--url') args.url = argv[++i];
  }
  return args;
}

const VIEWPORTS = [
  {
    name: 'desktop-1440x900',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
  {
    name: 'mobile-390x844',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
];

const BROWSERS = { chromium, webkit, firefox };

// Injected into the page before navigation. Exposes window.__perfStart /
// window.__perfStop() to drive rAF-based FPS sampling + a PerformanceObserver
// for longtasks, independent of any app code.
const PERF_INIT_SCRIPT = () => {
  window.__perf = {
    frameTimes: [],
    longtasks: { count: 0, totalMs: 0 },
    running: false,
    rafId: null,
  };

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.longtasks.count++;
        window.__perf.longtasks.totalMs += entry.duration;
      }
    });
    po.observe({ type: 'longtask', buffered: true });
    window.__perfObserver = po;
  } catch (e) {
    // longtask entry type not supported (e.g. WebKit) - continue without it.
    window.__perfLongtaskUnsupported = true;
  }

  window.__perfStart = function () {
    window.__perf.frameTimes = [];
    window.__perf.longtasks = { count: 0, totalMs: 0 };
    window.__perf.running = true;
    let last = performance.now();
    function tick(now) {
      if (!window.__perf.running) return;
      const dt = now - last;
      last = now;
      window.__perf.frameTimes.push(dt);
      window.__perf.rafId = requestAnimationFrame(tick);
    }
    window.__perf.rafId = requestAnimationFrame(tick);
  };

  window.__perfStop = function () {
    window.__perf.running = false;
    if (window.__perf.rafId) cancelAnimationFrame(window.__perf.rafId);
    const frameTimes = window.__perf.frameTimes.slice();
    // Drop the first sample - it measures time since __perfStart() was
    // called, not an inter-frame interval.
    const samples = frameTimes.slice(1);
    const n = samples.length;
    if (n === 0) {
      return {
        frameCount: 0,
        avgFps: 0,
        p1LowFps: 0,
        longFrameCount: 0,
        longtaskCount: window.__perf.longtasks.count,
        longtaskMs: window.__perf.longtasks.totalMs,
      };
    }
    const avgDt = samples.reduce((a, b) => a + b, 0) / n;
    const avgFps = 1000 / avgDt;
    // 1% low: average FPS of the slowest 1% of frames (longest frame times).
    const sorted = samples.slice().sort((a, b) => a - b);
    const onePctCount = Math.max(1, Math.ceil(n * 0.01));
    const worst = sorted.slice(-onePctCount);
    const worstAvgDt = worst.reduce((a, b) => a + b, 0) / worst.length;
    const p1LowFps = 1000 / worstAvgDt;
    const longFrameCount = samples.filter((dt) => dt > 50).length;
    return {
      frameCount: n,
      avgFps: Number(avgFps.toFixed(2)),
      p1LowFps: Number(p1LowFps.toFixed(2)),
      longFrameCount,
      longtaskCount: window.__perf.longtasks.count,
      longtaskMs: Number(window.__perf.longtasks.totalMs.toFixed(2)),
    };
  };
};

// Retry a page.evaluate() once if the execution context was destroyed by an
// unexpected navigation (observed: the dev server's Vite/HMR client can
// trigger a transient reload). addInitScript re-runs on every navigation, so
// a short wait + retry recovers cleanly instead of aborting the whole run.
async function evalWithRetry(page, fn, arg) {
  try {
    return await page.evaluate(fn, arg);
  } catch (err) {
    if (String(err && err.message).includes('Execution context was destroyed')) {
      await page.waitForTimeout(500);
      return await page.evaluate(fn, arg);
    }
    throw err;
  }
}

async function wheelScroll(page, { totalMs, direction, targetSelector }) {
  // Dispatch synthetic wheel events so Lenis (which listens for wheel, not
  // programmatic scrollTo) intercepts and smooths the scroll, matching real
  // user-perceived behavior as closely as possible in headless mode.
  const stepMs = 16; // ~60Hz dispatch rate
  const steps = Math.round(totalMs / stepMs);
  const pageHeight = await evalWithRetry(page, () => document.documentElement.scrollHeight);
  const viewportHeight = await evalWithRetry(page, () => window.innerHeight);
  const scrollDistance = targetSelector
    ? await evalWithRetry(page, (sel) => {
        const el = document.querySelector(sel);
        if (!el) return window.innerHeight * 3;
        const rect = el.getBoundingClientRect();
        return rect.height + window.innerHeight;
      }, targetSelector)
    : pageHeight - viewportHeight;
  const deltaPerStep = (scrollDistance / steps) * (direction === 'down' ? 1 : -1);

  for (let i = 0; i < steps; i++) {
    try {
      await page.mouse.wheel(0, deltaPerStep);
    } catch (err) {
      if (!String(err && err.message).includes('Execution context was destroyed')) throw err;
    }
    await page.waitForTimeout(stepMs);
  }
}

async function scrollToSelectorTop(page, selector) {
  await evalWithRetry(page, (sel) => {
    const el = document.querySelector(sel);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - 1));
    }
  }, selector);
  // Give Lenis a moment to sync its internal state with the forced scroll
  // position (it reads native scroll position on raf).
  await page.waitForTimeout(500);
}

async function measureScrollSequence(page, opts) {
  await evalWithRetry(page, () => window.__perfStart());
  await wheelScroll(page, { ...opts, direction: 'down' });
  await page.waitForTimeout(300);
  await wheelScroll(page, { ...opts, direction: 'up' });
  const result = await evalWithRetry(page, () => window.__perfStop());
  return result;
}

async function takeScreenshots(page, outPrefix) {
  const shots = {};
  const pageHeight = await evalWithRetry(page, () => document.documentElement.scrollHeight);
  const viewportHeight = await evalWithRetry(page, () => window.innerHeight);
  const maxScroll = Math.max(0, pageHeight - viewportHeight);
  for (const pct of [0, 25, 50, 75, 100]) {
    const y = Math.round((maxScroll * pct) / 100);
    await evalWithRetry(page, (yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(400);
    const file = `${outPrefix}-${pct}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, file) });
    shots[pct] = file;
  }
  await evalWithRetry(page, () => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  return shots;
}

async function runForViewport(browserType, browserName, url, vp) {
  const browser = await browserType.launch({ headless: true });
  const contextOpts = {
    viewport: vp.viewport,
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
  };
  // WebKit does not support isMobile in Playwright's context options.
  if (browserName === 'webkit') {
    delete contextOpts.isMobile;
  }
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  const consoleMessages = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleMessages.push({ type: 'pageerror', text: String(err && err.message ? err.message : err) });
  });
  page.on('requestfailed', (req) => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure() && req.failure().errorText,
    });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), method: res.request().method(), status: res.status() });
    }
  });

  await page.addInitScript(PERF_INIT_SCRIPT);

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  // Settle time: on a Vite/Astro dev server the HMR client can trigger a
  // brief extra reload right after initial load; wait it out before
  // measuring so it doesn't land mid-scroll.
  await page.waitForTimeout(1500);

  // Full-page scroll measurement (~8s down + settle + up).
  const fullPage = await measureScrollSequence(page, { totalMs: 8000, targetSelector: null });
  await evalWithRetry(page, () => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Work-section scroll measurement: scroll until #work enters view, then
  // measure scrolling through it to its end.
  await scrollToSelectorTop(page, '#work');
  const workSection = await measureScrollSequence(page, { totalMs: 8000, targetSelector: '#work' });
  await evalWithRetry(page, () => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  // Screenshots at 0/25/50/75/100% of page height.
  const outPrefix = `${browserName}-${vp.name}`;
  const screenshots = await takeScreenshots(page, outPrefix);

  // axe-core accessibility scan.
  let axeResults;
  try {
    const results = await new AxeBuilder({ page }).analyze();
    const bySeverity = { critical: [], serious: [] };
    for (const v of results.violations) {
      if (v.impact === 'critical' || v.impact === 'serious') {
        bySeverity[v.impact].push({ id: v.id, nodes: v.nodes.length, help: v.help });
      }
    }
    axeResults = {
      criticalCount: bySeverity.critical.reduce((a, v) => a + v.nodes, 0),
      seriousCount: bySeverity.serious.reduce((a, v) => a + v.nodes, 0),
      critical: bySeverity.critical,
      serious: bySeverity.serious,
    };
  } catch (e) {
    axeResults = { error: String(e && e.message ? e.message : e) };
  }

  await context.close();
  await browser.close();

  return {
    browser: browserName,
    viewport: vp.name,
    url,
    fullPageScroll: fullPage,
    workSectionScroll: workSection,
    console: {
      errorCount: consoleMessages.filter((m) => m.type === 'error' || m.type === 'pageerror').length,
      warningCount: consoleMessages.filter((m) => m.type === 'warning').length,
      messages: consoleMessages,
    },
    failedRequests,
    screenshots,
    axe: axeResults,
  };
}

async function main() {
  const { browser: browserName, url } = parseArgs(process.argv.slice(2));
  const browserType = BROWSERS[browserName];
  if (!browserType) {
    console.error(`Unknown browser: ${browserName}. Use chromium, webkit, or firefox.`);
    process.exit(1);
  }

  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${browserName} / ${vp.name} ===`);
    const result = await runForViewport(browserType, browserName, url, vp);
    const outFile = path.join(OUT_DIR, `${browserName}-${vp.name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`Wrote ${outFile}`);
    console.log(
      `  full-page  avgFps=${result.fullPageScroll.avgFps} p1Low=${result.fullPageScroll.p1LowFps} longFrames=${result.fullPageScroll.longFrameCount} longtasks=${result.fullPageScroll.longtaskCount}/${result.fullPageScroll.longtaskMs}ms`
    );
    console.log(
      `  work-section avgFps=${result.workSectionScroll.avgFps} p1Low=${result.workSectionScroll.p1LowFps} longFrames=${result.workSectionScroll.longFrameCount} longtasks=${result.workSectionScroll.longtaskCount}/${result.workSectionScroll.longtaskMs}ms`
    );
    console.log(
      `  console errors=${result.console.errorCount} warnings=${result.console.warningCount} failedRequests=${result.failedRequests.length}`
    );
    console.log(
      `  axe critical=${result.axe.criticalCount ?? 'n/a'} serious=${result.axe.seriousCount ?? 'n/a'}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
