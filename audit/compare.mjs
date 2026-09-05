// Print a compact comparison table of measurement runs: node audit/compare.mjs <label>...
import fs from 'node:fs'
const labels = process.argv.slice(2)
const combos = ['chromium-desktop-1440x900','chromium-mobile-390x844','webkit-desktop-1440x900','webkit-mobile-390x844']
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const lh = (label, form) => { const j = read(`audit/out/${label}/lighthouse-${form}.report.json`); if (!j) return '-'
  const c = j.categories, a = j.audits
  return `perf ${Math.round(c.performance.score*100)} a11y ${Math.round(c.accessibility.score*100)} LCP ${(a['largest-contentful-paint'].numericValue/1000).toFixed(1)}s TBT ${Math.round(a['total-blocking-time'].numericValue)}ms CLS ${a['cumulative-layout-shift'].numericValue.toFixed(2)}` }
for (const c of combos) {
  console.log(`\n# ${c}   (page FPS avg/1%low | WORK FPS avg/1%low longFrames | console err | failed req | axe crit/serious)`)
  for (const l of labels) { const j = read(`audit/out/${l}/${c}.json`); if (!j) { console.log(`${l.padEnd(18)} -`); continue }
    const f = j.fullPageScroll, w = j.workSectionScroll
    const cdp = w.cdp ? ` cdp[script ${w.cdp.ScriptDuration}ms recalc ${w.cdp.RecalcStyleDuration}ms layout ${w.cdp.LayoutDuration}ms]` : ''
    const tick = w.gsapTick ? ` tickMax ${w.gsapTick.tickMsMax}ms` : ''
    console.log(`${l.padEnd(18)} ${f.avgFps}/${f.p1LowFps} | ${w.avgFps}/${w.p1LowFps} lf${w.longFrameCount}${cdp}${tick} | ${j.console.errorCount} | ${j.failedRequests.length} | ${j.axe.criticalCount}/${j.axe.seriousCount}${j.axe.serious.length? ' '+j.axe.serious.map(s=>s.id).join(','):''}`) }
}
console.log('\n# lighthouse'); for (const l of labels) console.log(`${l.padEnd(18)} mobile: ${lh(l,'mobile')}\n${''.padEnd(18)} desktop: ${lh(l,'desktop')}`)
