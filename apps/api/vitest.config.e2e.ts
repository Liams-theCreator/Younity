import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		// Feature suites share one isolated database and assert whole-queue totals.
		// Keep files sequential; explicit decision-race requests remain concurrent.
		fileParallelism: false,
		globals: true,
		testTimeout: 15000,
		hookTimeout: 15000,
		root: './',
		include: ['**/*.e2e-spec.ts'],
	},
});
