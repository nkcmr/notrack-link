import { Badge, Box, Callout, Code, Container, Flex, Heading, Link, Spinner, Text } from '@radix-ui/themes';
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
		<Container size="2" py="6" px="4">
			<Flex direction="column" gap="4">
				<Heading size="6">
					{validURL ? (
						<Flex align="center" gap="2">
							{!done && <Spinner />}
							{done ? 'done!' : 'following link...'}
						</Flex>
					) : (
						'notrack.link'
					)}
				</Heading>

				{!!inputURL && !validURL && (
					<Callout.Root color="red">
						<Callout.Text>
							invalid input URL: <Code>{inputURL}</Code>
						</Callout.Text>
					</Callout.Root>
				)}

				{!validURL && (
					<Flex direction="column" gap="3">
						<Text>hi! this site follows links for you and removes crappy tracking parameters.</Text>
						<Text>
							simply put any link after the domain name, like:{' '}
							<Code>https://notrack.link/https://foo.bar</Code>
						</Text>
						<Text>
							try it out:{' '}
							<Link rel="noopener noreferrer nofollow" href="/https://bit.ly/3Yf8uaN">
								fun article
							</Link>
						</Text>
						<Text>
							check out the source code on{' '}
							<Link target="_blank" rel="noopener noreferrer" href="https://github.com/nkcmr/notrack-link">
								GitHub
							</Link>
						</Text>
					</Flex>
				)}

				<Flex direction="column" gap="3" id="results">
					{hops.map((hopInfo, i) => {
						const href = hopInfo.final
							? (hopInfo.location.cleaned || hopInfo.location.original) + getLocation().hash
							: hopInfo.location.original;
						return (
							<Box key={i} p="3" style={{ borderRadius: 'var(--radius-3)', border: '1px solid var(--gray-a6)', background: 'var(--gray-a2)' }}>
								<Flex direction="column" gap="1">
									<Code size="1" color="gray">
										hop ({hopInfo.seq})
									</Code>
									{hopInfo.final ? (
										<>
											<Link rel="noopener noreferrer nofollow" href={href} size="2" style={{ wordBreak: 'break-all' }}>
												{href}
											</Link>
											{hopInfo.error ? (
												<Callout.Root color="red" size="1">
													<Callout.Text>{hopInfo.error}</Callout.Text>
												</Callout.Root>
											) : (
												<Text size="2" color="green">
													ok: last stop in redirect chain ({hopInfo.status_code})
												</Text>
											)}
											{hopInfo.location.removed_params.length > 0 && (
												<Text size="1" color="gray">
													tracking params removed:{' '}
													{hopInfo.location.removed_params.map((p, j) => (
														<Badge key={j} color="orange" size="1" mr="1">
															{p}
														</Badge>
													))}
												</Text>
											)}
										</>
									) : (
										<Code size="2" style={{ wordBreak: 'break-all' }}>
											{href}
										</Code>
									)}
								</Flex>
							</Box>
						);
					})}
				</Flex>

				{err && (
					<Callout.Root color="red">
						<Callout.Text>{err}</Callout.Text>
					</Callout.Root>
				)}
			</Flex>
		</Container>
	);
}
