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
			data: {"status_code":200,"seq":1,"location":{"original":"https://www.formula1.com/en/latest/article/horner-hopes-to-keep-brilliant-character-ricciardo-in-red-bull-family-as-he.35V3EQeLJzy5aYtsQHAEpA?sfmc_id=6c13d996-dad7-4483-9cb2-57c581291777&utm_source=Ogilvy&utm_term=SingleStory&utm_content=14035&utm_id=f226ed2f-4064-4645-96fb-39d28bc364f5&sfmc_activityid=63f15157-ec7e-4ac7-a3be-873f3f8873d2&utm_medium=email&sfmc_journey_id=f226ed2f-4064-4645-96fb-39d28bc364f5&sfmc_journey_name=02420140N_noR-caWeeeekdn&sfmc_activity_id=63f15157-ec7e-4ac7-a3be-873f3f8873d2&sfmc_activity_name=uSjbceLtni_eeTtsG_nereci&sfmc_asset_id=14035&sfmc_channel=email","cleaned":"https://www.formula1.com/en/latest/article/horner-hopes-to-keep-brilliant-character-ricciardo-in-red-bull-family-as-he.35V3EQeLJzy5aYtsQHAEpA","removed_params":["utm_source","utm_term","utm_content","utm_id","utm_medium","sfmc_id","sfmc_activityid","sfmc_journey_id","sfmc_journey_name","sfmc_activity_id","sfmc_activity_name","sfmc_asset_id","sfmc_channel"]},"final":true}

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
			data: {"status_code":200,"seq":1,"location":{"original":"https://www.formula1.com/en/latest/article/horner-hopes-to-keep-brilliant-character-ricciardo-in-red-bull-family-as-he.35V3EQeLJzy5aYtsQHAEpA?sfmc_id=6c13d996-dad7-4483-9cb2-57c581291777&utm_source=Ogilvy&utm_term=SingleStory&utm_content=14035&utm_id=f226ed2f-4064-4645-96fb-39d28bc364f5&sfmc_activityid=63f15157-ec7e-4ac7-a3be-873f3f8873d2&utm_medium=email&sfmc_journey_id=f226ed2f-4064-4645-96fb-39d28bc364f5&sfmc_journey_name=02420140N_noR-caWeeeekdn&sfmc_activity_id=63f15157-ec7e-4ac7-a3be-873f3f8873d2&sfmc_activity_name=uSjbceLtni_eeTtsG_nereci&sfmc_asset_id=14035&sfmc_channel=email","cleaned":"https://www.formula1.com/en/latest/article/horner-hopes-to-keep-brilliant-character-ricciardo-in-red-bull-family-as-he.35V3EQeLJzy5aYtsQHAEpA","removed_params":["utm_source","utm_term","utm_content","utm_id","utm_medium","sfmc_id","sfmc_activityid","sfmc_journey_id","sfmc_journey_name","sfmc_activity_id","sfmc_activity_name","sfmc_asset_id","sfmc_channel"]},"final":true}

			"
		`);
	});
});
