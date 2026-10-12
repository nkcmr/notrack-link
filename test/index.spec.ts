// test/index.spec.ts
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { network } from './network';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const START_URL = 'https://click.tracker.test/c/abc123';

// Minimal stand-in for the ClearURLs rules list (https://rules1.clearurls.xyz/data.minify.json)
const RULES = {
	providers: {
		globalRules: {
			urlPattern: '.*',
			completeProvider: false,
			rules: ['(?:%3F)?utm(?:_[a-z_]*)?'],
			exceptions: [],
		},
	},
};

// Redirect chain: 302 with a relative Location -> HTML meta refresh -> final page with tracking params.
function mockNetwork(): string[] {
	const unhandled: string[] = [];
	network.use(
		http.get('https://rules1.clearurls.xyz/data.minify.json', () => HttpResponse.json(RULES)),
		http.get(START_URL, () => new HttpResponse(null, { status: 302, headers: { Location: '/landing' } })),
		http.get('https://click.tracker.test/landing', () =>
			HttpResponse.html(
				'<html><head><meta http-equiv="refresh" content="0; url=https://shop.test/product?id=42&utm_source=newsletter&utm_campaign=fall"></head></html>',
			),
		),
		http.get('https://shop.test/product', () => HttpResponse.text('ok')),
		// Fail loudly instead of reaching the real network.
		http.all('*', ({ request }) => {
			unhandled.push(`${request.method} ${request.url}`);
			return HttpResponse.error();
		}),
	);
	return unhandled;
}

const EXPECTED = `event: hop
data: {"seq":0,"location":{"original":"https://click.tracker.test/c/abc123"},"final":false,"status_code":302}

event: hop
data: {"seq":1,"location":{"original":"https://click.tracker.test/landing"},"final":false,"status_code":200}

event: hop
data: {"status_code":200,"seq":2,"location":{"original":"https://shop.test/product?id=42&utm_source=newsletter&utm_campaign=fall","cleaned":"https://shop.test/product?id=42","removed_params":["utm_source","utm_campaign"]},"final":true}

`;

describe('notrack.link', () => {
	it('follows and cleans links (unit style)', async () => {
		const unhandled = mockNetwork();
		const request = new IncomingRequest(`http://notrack.link.test/iterhops/${START_URL}`);
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toBe(EXPECTED);
		expect(unhandled).toEqual([]);
	});

	it('follows and cleans links (integration style)', async () => {
		const unhandled = mockNetwork();
		const response = await exports.default.fetch(`http://notrack.link.test/iterhops/${START_URL}`);
		expect(await response.text()).toBe(EXPECTED);
		expect(unhandled).toEqual([]);
	});
});
