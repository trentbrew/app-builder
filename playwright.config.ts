import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: process.env.PW_BASE_URL ?? 'http://localhost:9898',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: process.env.PW_REUSE
		? undefined
		: {
				command: 'PUBLIC_SANDBOX_BACKEND=webcontainer pnpm dev',
				url: 'http://localhost:9898',
				reuseExistingServer: true,
				timeout: 120_000
			}
});
