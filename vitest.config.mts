import path from 'node:path';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
	resolve: {
		alias: {
			'@radix-ui/themes': path.resolve('./test/radix-stub.ts'),
		},
	},
	test: {
		setupFiles: ['./test/setup.ts'],
	},
});
