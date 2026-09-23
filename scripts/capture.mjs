/**
 * Record a scrolling clip of a page and write it into src/assets/works.
 *
 *   node scripts/capture.mjs <url> <Name>
 *
 * The file lands as <Name>-<n>.mp4, which is the naming SWork.astro reads: the
 * part before the dash is the key of the entry in its `info` map. Needs ffmpeg
 * on PATH, and Playwright's chromium (npx playwright install chromium).
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, name] = process.argv.slice(2)

if (!url || !name) {
  console.error('usage: node scripts/capture.mjs <url> <Name>')
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

const height = await page.evaluate(() => document.body.scrollHeight)
const steps = 40
for (let i = 0; i <= steps; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round((height - 800) * (i / steps)))
  await page.waitForTimeout(120)
}
await page.waitForTimeout(500)
await context.close()
await browser.close()

const webm = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')))
execFileSync('ffmpeg', [
  '-loglevel', 'error', '-y', '-i', webm,
  '-vf', 'scale=960:-2',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-preset', 'veryfast', '-an',
  out,
])
rmSync(dir, { recursive: true, force: true })

console.log(`wrote ${out}`)
console.log(`add an entry keyed "${name}" to info in src/components/SWork.astro`)
