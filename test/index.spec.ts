// test/index.spec.ts
import { createExecutionContext, env, SELF, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('notrack.link', () => {
	it('follows and cleans links (unit style)', async () => {
		const request = new IncomingRequest(
			'http://notrack.link.test/iterhops/https://click.email.formula1.com/?qs=02e5c36717c987501eea7f57f03282d93d62353d02ec0bc5f9df92d5b1f6f3e18449e1229141dde21c7a85aaa36a40c9345cf53eb9650203f453398837581fbe'
		);
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`
			"event: hop
			data: {"seq":0,"location":{"original":"https://click.email.formula1.com/?qs=02e5c36717c987501eea7f57f03282d93d62353d02ec0bc5f9df92d5b1f6f3e18449e1229141dde21c7a85aaa36a40c9345cf53eb9650203f453398837581fbe"},"final":false,"status_code":302}

			event: hop
			data: {"status_code":200,"seq":1,"location":{"original":"https://click.email.formula1.com/expired.html","cleaned":"https://click.email.formula1.com/expired.html","removed_params":[]},"final":true}

			"
		`);
	});

	it('follows and cleans links (integration style)', async () => {
		const response = await SELF.fetch(
			'http://notrack.link.test/iterhops/https://click.email.formula1.com/?qs=02e5c36717c987501eea7f57f03282d93d62353d02ec0bc5f9df92d5b1f6f3e18449e1229141dde21c7a85aaa36a40c9345cf53eb9650203f453398837581fbe'
		);
		expect(await response.text()).toMatchInlineSnapshot(`
			"event: hop
			data: {"seq":0,"location":{"original":"https://click.email.formula1.com/?qs=02e5c36717c987501eea7f57f03282d93d62353d02ec0bc5f9df92d5b1f6f3e18449e1229141dde21c7a85aaa36a40c9345cf53eb9650203f453398837581fbe"},"final":false,"status_code":302}

			event: hop
			data: {"status_code":200,"seq":1,"location":{"original":"https://click.email.formula1.com/expired.html","cleaned":"https://click.email.formula1.com/expired.html","removed_params":[]},"final":true}

			"
		`);
	});
});
