import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
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
					// frame-ancestors is ignored in <meta> CSP; it is sent via static/_headers.
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
			adapter: adapter({ fallback: "404.html" }),
		}),
	],
	test: {
		include: ["src/**/*.test.ts"],
		exclude: ["tests/e2e/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			// Browser-only glue (worker, its client and the reactive session) is covered by the smoke tests.
			exclude: [
				"src/lib/processor/protocol.ts",
				"src/lib/processor/worker.ts",
				"src/lib/processor/client.ts",
				"src/lib/processor/session.svelte.ts",
			],
			thresholds: {
				lines: 83,
				functions: 98,
				branches: 71,
				statements: 80,
			},
		},
	},
});
