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

function cleanLink(url: string): [string, boolean] {
	const cloneURL = URL.parse(url);
	if (!cloneURL) {
		return [url, false];
	}
	const deleteParams = [];
	switch (cloneURL.host) {
		case 'youtu.be':
		case 'www.youtube.com':
			for (let dp of ['si', 'feature']) {
				if (cloneURL.searchParams.has(dp)) {
					deleteParams.push(dp);
				}
			}
			break;
	}

	for (let trackerParam of [
		// https://en.wikipedia.org/wiki/UTM_parameters
		'utm_id',
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_term',
		'utm_content',
		'utm_channel',
		'utm_mailing',

		// salesforce
		/^sfmc_(journey_(id|name)|activity_?(id|name)|asset_id|channel|id)$/,

		// common ad-hoc tracker
		'ref',
	]) {
		if (trackerParam instanceof RegExp) {
			for (let param of cloneURL.searchParams.keys()) {
				if (trackerParam.test(param)) {
					deleteParams.push(param);
				}
			}
			continue;
		}
		if (cloneURL.searchParams.has(trackerParam)) {
			deleteParams.push(trackerParam);
		}
	}
	if (deleteParams.length === 0) {
		return [url, false];
	}
	for (let dp of deleteParams) {
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
				const [cleanedLink, didModify] = cleanLink(currentURL);
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
