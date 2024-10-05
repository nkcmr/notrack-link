import { followLink, isValidURLString } from './scout';
import { RenderIndex } from './ssr';

function strbytes(s: string): Uint8Array {
	const te = new TextEncoder();
	return te.encode(s);
}

async function eventSourceEmit(w: WritableStreamDefaultWriter<Uint8Array>, event: string, data: any) {
	await w.write(strbytes(`event: ${event}\n`));
	await w.write(strbytes(`data: ${JSON.stringify(data)}\n\n`));
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const baseu = new URL(request.url);
		const followBasePath = '/iterhops/';
		if (baseu.pathname.startsWith(followBasePath)) {
			const { readable, writable } = new TransformStream();
			queueMicrotask(async () => {
				const writer = writable.getWriter();
				try {
					const baseIdx = request.url.indexOf(followBasePath);
					if (baseIdx < 0) {
						throw new Error('internal error (1)');
					}
					const inputLink = request.url.slice(baseIdx + followBasePath.length);
					if (!isValidURLString(inputLink)) {
						throw new Error(`invalid link: ${inputLink}`);
					}

					for await (let hop of followLink(inputLink)) {
						await eventSourceEmit(writer, 'hop', hop);
					}
				} catch (e) {
					await eventSourceEmit(writer, 'hop_error', {
						message: `${(e as any).message ?? e}`,
					});
				} finally {
					await writer.close();
				}
			});
			return new Response(readable, { headers: { 'content-type': 'text/event-stream' } });
		}

		// beep boop
		if (baseu.pathname.startsWith('/assets')) {
			const pathParts = baseu.pathname.split('/');
			pathParts.shift(); // ""
			pathParts.shift(); // "assets"
			pathParts.shift(); // version
			const newURL = new URL(baseu);
			newURL.pathname = pathParts.join('/');
			const cachedResponse = await caches.default.match(request, {});
			if (cachedResponse) {
				return cachedResponse;
			}
			const freshResponse = await env.BUILD_ASSETS.fetch(newURL, request);
			if (freshResponse.ok) {
				ctx.waitUntil(caches.default.put(request, freshResponse.clone()));
			}
			return freshResponse;
		}

		return RenderIndex(env, {
			getLocation() {
				return baseu;
			},
		});
	},
} satisfies ExportedHandler<Env>;
