import { test, expect } from '@playwright/test'

// Words that belong to the template author, not to this site. If any of them
// reappear in the built page, the site is claiming someone else's identity.
const FOREIGN = [
  'Antoine',
  'Wodniack',
  'Awwwards',
  'Webby',
  'Coding globally from France',
  'DUMMY PROJECT',
  'Dummy Project',
  'codepen.io/your-username',
  'hello@example.com',
]

test('the page carries his identity and none of the template author\'s', async ({ page }) => {
  await page.goto('/')
  const html = await page.content()

  for (const word of FOREIGN) {
    expect(html, `template identity left in the page: ${word}`).not.toContain(word)
  }

  await expect(page).toHaveTitle(/Jakhangir Tynshimov/)
  expect(html).toContain('Building from Corvallis, Oregon.')
  expect(html).toContain('github.com/Jakhangir18')
  expect(html).toContain('linkedin.com/in/tynshimov')
  expect(html).toContain('tynshimj@oregonstate.edu')
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('shows the page at once and still scrolls', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))

    await page.goto('/')
    await page.waitForTimeout(2000)

    // The intro curtain is gone and scrolling is released, without waiting out
    // the five-second timeline a normal visitor sees.
    await expect(page.locator('.js-intro')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.classList.contains('is-scroll-blocked'))).toBe(false)
    expect(await page.evaluate(() => document.documentElement.classList.contains('is-reduced-motion'))).toBe(true)
    expect(await page.evaluate(() => typeof window.lenis)).toBe('undefined')

    // The menu must not depend on Lenis, which never starts in this mode.
    await page.click('a[href="#about"]')
    await page.waitForTimeout(1000)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    expect(errors).toEqual([])
  })
})

test('no horizontal overflow at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForTimeout(2000)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
