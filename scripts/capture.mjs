/**
 * Record a scrolling clip of a page and write it into src/assets/works.
 *
 *   node scripts/capture.mjs <url> <Name>
 *
 * The file lands as <Name>-<n>.mp4, which is the naming SWork.astro reads: the
 * part before the dash is the key of the entry in its `info` map. Needs ffmpeg
 * on PATH, and Playwright's chromium (npx playwright install chromium). The
 * browser comes from @playwright/test, the same dependency the suite uses.
 */
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, name] = process.argv.slice(2)

if (!url || !name) {
  console.error('usage: node scripts/capture.mjs <url> <Name>')
  process.exit(2)
}

// SWork.astro reads the project key as everything before the first dash in the
// file name, so a name containing one would point at a key that does not exist
// and the clip would be dropped from the page without a word.
if (name.includes('-')) {
  console.error(`the project name may not contain a dash: ${name}`)
  process.exit(2)
}

const works = new URL('../src/assets/works/', import.meta.url).pathname
const taken = readdirSync(works).filter((f) => f.startsWith(`${name}-`)).length
const out = join(works, `${name}-${taken + 1}.mp4`)
const dir = mkdtempSync(join(tmpdir(), 'capture-'))

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// The height is read again on every step: a page that loads content as it is
// scrolled grows while the capture runs, and a height read once would stop the
// clip short of the real bottom.
const steps = 40
for (let i = 0; i <= steps; i++) {
  const height = await page.evaluate(() => document.body.scrollHeight)
  await page.evaluate((y) => window.scrollTo(0, y), Math.round((height - 800) * (i / steps)))
  await page.waitForTimeout(120)
}
await page.waitForTimeout(500)
await context.close()
await browser.close()

const recorded = readdirSync(dir).find((f) => f.endsWith('.webm'))

if (!recorded) {
  rmSync(dir, { recursive: true, force: true })
  console.error(`no video was written for ${url}; the page may have failed to load`)
  process.exit(1)
}

const webm = join(dir, recorded)
execFileSync('ffmpeg', [
  '-loglevel', 'error', '-y', '-i', webm,
  '-vf', 'scale=960:-2',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'veryfast', '-an',
  out,
])
rmSync(dir, { recursive: true, force: true })

console.log(`wrote ${out}`)
console.log(`add an entry keyed "${name}" to info in src/components/SWork.astro`)
