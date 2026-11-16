import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "*.smoke.spec.ts",
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
		// Build then serve the real static-asset server (wrangler dev, assets-only):
		// exercises the prerendered page, the 404 page and _headers deployment.
		command: "pnpm build && pnpm exec wrangler dev --port 4399",
		url: "http://127.0.0.1:4399",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
