import indexHTML from './index.html';

type LinkHop =
	| {
			seq: number;
			location: string;
			responseCode?: number;
			final: false;
	  }
	| {
			seq: number;
			location: string;
			cleanedLocation?: string;
			responseCode?: number;
			error?: string;
			final: true;
	  };

function deleteSearchParam(params: URLSearchParams, key: string): boolean {
	if (params.has(key)) {
		params.delete(key);
		return true;
	}
	return false;
}
function cleanLink(url: string): [string, boolean] {
	const cloneURL = URL.parse(url);
	if (!cloneURL) {
		return [url, false];
	}
	let modified = false;
	switch (cloneURL.host) {
		case 'youtu.be':
		case 'www.youtube.com':
			modified = deleteSearchParam(cloneURL.searchParams, 'si') || modified;
			modified = deleteSearchParam(cloneURL.searchParams, 'feature') || modified;
			break;
	}
	for (let trackerParam of [
		// https://en.wikipedia.org/wiki/UTM_parameters
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_term',
		'utm_content',

		// common ad-hoc tracker
		'ref',
	]) {
		modified = deleteSearchParam(cloneURL.searchParams, trackerParam) || modified;
	}
	cloneURL.search = cloneURL.searchParams.toString();
	return [cloneURL.toString(), modified];
}

function randint(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

type ValidURLString = string & { __valid_url: string };

function isValidURLString(s: string): s is ValidURLString {
	return URL.canParse(s);
}

type FetchFailure = {
	error: string;
};

function followLink(linkHref: ValidURLString): AsyncIterable<LinkHop> {
	return {
		async *[Symbol.asyncIterator]() {
			let currentURL = linkHref;
			let redirectCount = 0;
			const timeoutPromise = sleep(10_000);
			const MAX_REDIRECTS = 10;
			while (true) {
				currentURL = currentURL.replace(/^http:\/\//i, 'https://') as ValidURLString;
				await sleep(randint(50, 150));
				const response = await Promise.race([
					fetch(currentURL, {
						redirect: 'manual',
						headers: {
							Accept: '*/*',
							'User-Agent': 'notrack.link/1.0',
							'Cache-Control': 'no-cache',
							Pragma: 'no-cache',
						},
					}).catch((e) => ({
						error: `request failed: ${e.message || e}`,
					})),
					timeoutPromise.then(
						(): FetchFailure => ({
							error: 'timeout',
						})
					),
				]);
				let error: string | undefined;
				let responseCode: number | undefined;
				if (response instanceof Response) {
					responseCode = response.status;
					const final = ![301, 302, 303, 307, 308].includes(response.status);
					console.log(`response: url=${currentURL} status=${response.status} final=${final}`);
					if (!final) {
						yield { seq: redirectCount, location: currentURL, final: false, responseCode };
						const nextLocation = response.headers.get('location');
						if (!nextLocation) {
							throw new Error(`redirect response contained no "location" header ${[...response.headers.keys()]}`);
						}
						const nextURL = URL.parse(nextLocation, currentURL);
						if (!nextURL) {
							throw new Error(`invalid location header received from ${currentURL}: ${nextLocation}`);
						}
						redirectCount++;
						if (redirectCount < MAX_REDIRECTS) {
							currentURL = nextURL.toString() as ValidURLString;
							continue;
						}
						error = 'maximum redirects';
					} else if (!response.ok) {
						error = `non-ok response (${response.status} ${response.statusText})`;
					}
				} else {
					error = response.error;
				}
				let cleanedLocation: string | undefined;
				const [cleanedLink, didModify] = cleanLink(currentURL);
				if (didModify) {
					cleanedLocation = cleanedLink;
				}
				yield {
					responseCode,
					seq: redirectCount,
					location: currentURL,
					cleanedLocation,
					error,
					final: true,
				};
				return;
			}
			throw new Error(`impossible`);
		},
	};
}

function strbytes(s: string): Uint8Array {
	const te = new TextEncoder();
	return te.encode(s);
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const baseu = new URL(request.url);
		const followBasePath = '/iterhops/';
		if (baseu.pathname.startsWith(followBasePath)) {
			// "" "follow" "http..."
			let { readable, writable } = new TransformStream();
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
						await writer.write(strbytes(`event: hop\n`));
						await writer.write(strbytes(`data: ${JSON.stringify(hop)}\n\n`));
					}
				} catch (e) {
					await writer.write(strbytes(`event: hop_error\n`));
					await writer.write(strbytes(`data: ${JSON.stringify({ message: `${(e as any).message ?? e}` })}\n\n`));
				} finally {
					await writer.close();
				}
			});
			return new Response(readable, { headers: { 'content-type': 'text/event-stream' } });
		}
		return new Response(indexHTML, { headers: { 'Content-Type': 'text/html' } });
	},
} satisfies ExportedHandler<Env>;
