import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		exclude: ['e2e/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			exclude: [
				'src/**/index.ts',
				'src/lib/processor/types.ts',
				'src/lib/processor/worker-protocol.ts',
				'src/lib/processor/processor.worker.ts',
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
