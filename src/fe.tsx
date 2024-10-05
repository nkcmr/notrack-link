import { useEffect, useState } from 'react';
import { isBrowser } from './runtime';
import { LinkHop } from './scout';

export type AppProps = {
	getLocation: () => URL;
};

function extractInputURL(original: URL): string {
	const href = original.toString();
	const currentHost = original.host;
	const hostStrIdx = href.indexOf(currentHost);
	return href.slice(hostStrIdx + currentHost.length + 1 /* trim "/" */);
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
	return (
		<>
			<span style={{ color: 'red', fontWeight: 'bold' }}>error&nbsp;</span>&nbsp;{children}
		</>
	);
}

export function App({ getLocation }: AppProps) {
	const inputURL = extractInputURL(getLocation());
	const validURL = URL.canParse(inputURL);
	const [hops, setHops] = useState<LinkHop[]>([]);
	const [done, setDone] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	useEffect(() => {
		if (!isBrowser()) {
			return;
		}
		if (!validURL) {
			return;
		}
		const es = new EventSource(`/iterhops/${inputURL}`);
		es.addEventListener('error', () => {
			es.close();
			setErr(`failed to connect to backend (did an ad blocker interfere? it can get confused with links that do tracking.)`);
		});
		es.addEventListener('hop_error', (event) => {
			es.close();
			const errorInfo = JSON.parse((event as any).data);
			setErr(errorInfo.message);
		});
		es.addEventListener('hop', (event) => {
			const hopInfo = JSON.parse((event as any).data);
			if (hopInfo.final) {
				setDone(true);
				es.close();
				setTimeout(() => {
					// window.location.href = hopInfo.cleanedLocation || hopInfo.location;
				}, 1000);
			}
			setHops((hops) => [...hops, hopInfo]);
		});
	}, []);

	return (
		<div>
			<h1>{validURL ? (done ? 'done!' : 'following link...') : 'notrack.link'}</h1>
			{!!inputURL && !validURL ? (
				<div>
					<ErrorMessage>
						invalid input URL: <code>{inputURL}</code>
					</ErrorMessage>
				</div>
			) : (
				''
			)}
			{!validURL ? (
				<>
					<p>hi! this site follows links for you and removes crappy tracking parameters.</p>
					<p>
						simply put any link after the domain name, like: <code>https://notrack.link/https://foo.bar</code>
					</p>
				</>
			) : (
				''
			)}
			<div id="results">
				{hops.map((hopInfo) => (
					<div className="hop" style={{ marginTop: '1.5em' }}>
						{/* <pre>{JSON.stringify(hopInfo, null, 2)}</pre> */}
						<code>hop ({hopInfo.seq})</code>
						<br />
						{hopInfo.final ? (
							<>
								<a rel="noopener noreferrer nofollow" href={hopInfo.cleaned_location || hopInfo.location}>
									{hopInfo.cleaned_location || hopInfo.location}
								</a>
								<br />
								{hopInfo.error ? (
									<ErrorMessage>{hopInfo.error}</ErrorMessage>
								) : (
									<>
										<span style={{ color: 'green', fontWeight: 'bold' }}>ok: </span>last stop in redirect chain ({hopInfo.status_code})
									</>
								)}
								{hopInfo.cleaned_location && (
									<>
										<br />
										(some link trackers removed)
									</>
								)}
							</>
						) : (
							<code>{hopInfo.location}</code>
						)}
						<br />
					</div>
				))}
			</div>
			{err && (
				<div>
					<ErrorMessage>{err}</ErrorMessage>
				</div>
			)}
		</div>
	);
}
