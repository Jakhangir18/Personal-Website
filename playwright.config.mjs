import { defineConfig } from '@playwright/test'

// The suite runs against the production build, because that is what ships.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:4327' },
  webServer: {
    command: 'npm run build && npx astro preview --host 127.0.0.1 --port 4327',
    url: 'http://127.0.0.1:4327',
    timeout: 180_000,
    reuseExistingServer: false,
  },
})
