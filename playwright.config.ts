import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	reporter: process.env.CI ? [["github"], ["list"]] : "list",
	use: {
		baseURL: "http://127.0.0.1:4399",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "pnpm exec svelte-kit sync && pnpm dev --host 127.0.0.1 --port 4399",
		url: "http://127.0.0.1:4399",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
