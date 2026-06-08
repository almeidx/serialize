import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			csp: {
				mode: "auto",
				directives: {
					"default-src": ["self"],
					"base-uri": ["none"],
					"object-src": ["none"],
					"frame-ancestors": ["none"],
					"form-action": ["self"],
					"script-src": ["self"],
					"style-src": ["self", "unsafe-inline"],
					"img-src": ["self", "data:"],
					"font-src": ["self", "data:"],
					"connect-src": ["self"],
					"worker-src": ["self"],
					"manifest-src": ["self"],
				},
			},
			adapter: adapter(),
		}),
	],
	test: {
		include: ["src/**/*.test.ts"],
		exclude: ["tests/e2e/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			exclude: [
				"src/**/index.ts",
				"src/lib/processor/types.ts",
				"src/lib/processor/worker-protocol.ts",
				"src/lib/processor/processor.worker.ts",
			],
			thresholds: {
				lines: 83,
				functions: 98,
				branches: 72,
				statements: 80,
			},
		},
	},
});
