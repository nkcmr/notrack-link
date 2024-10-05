export type LinkHop =
	| {
			seq: number;
			location: string;
			status_code?: number;
			final: false;
	  }
	| {
			seq: number;
			location: string;
			cleaned_location?: string;
			status_code?: number;
			error?: string;
			final: true;
	  };

const RULES_JSON_URL = 'https://rules1.clearurls.xyz/data.minify.json';
let rulesRuntimeCacheRawData: any;
let rulesRuntimeCache: provider[];

type provider = {
	name: string;
	urlPattern: RegExp;
	exceptions: RegExp[];
	removeParamRules: RegExp[];
};

interface RulesProcessor {
	match(url: string): Iterable<provider>;
}

function parseRegexp(pattern: string, flags?: string): RegExp | null {
	try {
		const r = new RegExp(pattern, flags);
		return r;
	} catch {
		return null;
	}
}

async function getCleanLinkRules(): Promise<RulesProcessor> {
	if (!rulesRuntimeCacheRawData) {
		console.log('getCleanLinkRules: RUNTIME CACHE MISS');
		const getListRequest = new Request(RULES_JSON_URL);
		const cachedResponse = await caches.default.match(getListRequest);
		if (cachedResponse) {
			rulesRuntimeCacheRawData = await cachedResponse.json();
		} else {
			console.log('getCleanLinkRules: CACHE MISS');
			const freshResponse = await fetch(getListRequest);
			await caches.default.put(getListRequest, freshResponse.clone());
			rulesRuntimeCacheRawData = await freshResponse.json();
		}
	}
	if (!rulesRuntimeCache) {
		const p: provider[] = [];
		for (let [providerName, providerConfig] of Object.entries(rulesRuntimeCacheRawData.providers) as [string, any][]) {
			if (providerConfig.completeProvider) {
				continue;
			}
			const urlPattern = parseRegexp((providerConfig as any).urlPattern);
			if (!urlPattern) {
				console.log(`getCleanLinkRules: invalid urlPattern on ${providerName}`);
				continue;
			}

			const exceptions = [];
			for (let exceptPattern of providerConfig.exceptions ?? []) {
				const p = parseRegexp(exceptPattern);
				if (!p) {
					console.log(`getCleanLinkRules: invalid exception pattern on ${providerName}`);
					continue;
				}
				exceptions.push(p);
			}

			const removeParamRules = [];
			for (let rulePattern of providerConfig.rules ?? []) {
				const rp = parseRegexp(rulePattern);
				if (!rp) {
					console.log(`getCleanLinkRules: invalid rule pattern on ${providerName}`);
					continue;
				}
				removeParamRules.push(rp);
			}

			p.push({
				name: providerName,
				urlPattern,
				exceptions,
				removeParamRules,
			});
		}
		rulesRuntimeCache = p;
	}

	return {
		match(url) {
			return {
				*[Symbol.iterator]() {
					providerLoop: for (let p of rulesRuntimeCache) {
						if (!p.urlPattern.test(url)) {
							continue;
						}
						for (let e of p.exceptions) {
							if (e.test(url)) {
								continue providerLoop;
							}
						}
						yield p;
					}
				},
			};
		},
	};
}

async function cleanLink(url: string): Promise<[string, boolean]> {
	const cloneURL = URL.parse(url);
	if (!cloneURL) {
		return [url, false];
	}

	console.time('getCleanLinkRules');
	const rulesProc = await getCleanLinkRules();
	console.timeEnd('getCleanLinkRules');

	const matchedProviders = [];
	const allParams = [...cloneURL.searchParams.keys()];
	const deleteParams = new Set<string>();
	for (let p of rulesProc.match(url)) {
		matchedProviders.push(p.name);
		for (let r of p.removeParamRules) {
			for (let up of allParams) {
				if (r.test(up)) {
					deleteParams.add(up);
				}
			}
		}
	}
	console.log('cleanlink rules results', {
		toDelete: [...deleteParams.values()],
		matchedProviders,
	});

	// const deleteParams = [];
	// switch (cloneURL.host) {
	// 	case 'youtu.be':
	// 	case 'www.youtube.com':
	// 		for (let dp of ['si', 'feature']) {
	// 			if (cloneURL.searchParams.has(dp)) {
	// 				deleteParams.push(dp);
	// 			}
	// 		}
	// 		break;
	// }

	// for (let trackerParam of [
	// 	// https://en.wikipedia.org/wiki/UTM_parameters
	// 	'utm_id',
	// 	'utm_source',
	// 	'utm_medium',
	// 	'utm_campaign',
	// 	'utm_term',
	// 	'utm_content',
	// 	'utm_channel',
	// 	'utm_mailing',
	// 	'utm_brand',

	// 	// salesforce
	// 	/^sfmc_(journey_(id|name)|activity_?(id|name)|asset_id|channel|id)$/,

	// 	// common ad-hoc tracker
	// 	'ref',
	// ]) {
	// 	if (trackerParam instanceof RegExp) {
	// 		for (let param of cloneURL.searchParams.keys()) {
	// 			if (trackerParam.test(param)) {
	// 				deleteParams.push(param);
	// 			}
	// 		}
	// 		continue;
	// 	}
	// 	if (cloneURL.searchParams.has(trackerParam)) {
	// 		deleteParams.push(trackerParam);
	// 	}
	// }
	if (deleteParams.size === 0) {
		return [url, false];
	}
	for (let dp of deleteParams.values()) {
		cloneURL.searchParams.delete(dp);
	}
	return [cloneURL.toString(), true];
}

type FetchFailure = {
	error: string;
};

function randint(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export type ValidURLString = string & { __valid_url: string };

export function isValidURLString(s: string): s is ValidURLString {
	return URL.canParse(s);
}

export function followLink(linkHref: ValidURLString): AsyncIterable<LinkHop> {
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
							'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0 notrack.link/1.0',
							'Cache-Control': 'no-cache',
							Pragma: 'no-cache',
						},
					}).catch(
						(e): FetchFailure => ({
							error: `request failed: ${e.message || e}`,
						})
					),
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
					if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
						// const r = new HTMLRewriter()
						// r.on('meta', new class {})
						// r.transform(response)
					}
					const final = ![301, 302, 303, 307, 308].includes(response.status);
					console.log(`response: url=${currentURL} status=${response.status} final=${final}`);
					if (!final) {
						yield {
							seq: redirectCount,
							location: currentURL,
							final: false,
							status_code: responseCode,
						} satisfies LinkHop;
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
				const [cleanedLink, didModify] = await cleanLink(currentURL);
				if (didModify) {
					cleanedLocation = cleanedLink;
				}
				yield {
					status_code: responseCode,
					seq: redirectCount,
					location: currentURL,
					cleaned_location: cleanedLocation,
					error,
					final: true,
				} satisfies LinkHop;
				return;
			}
			throw new Error(`impossible`);
		},
	};
}
