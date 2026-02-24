import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4399',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'pnpm dev --host 127.0.0.1 --port 4399',
		port: 4399,
		reuseExistingServer: false,
		timeout: 120_000
	}
});
