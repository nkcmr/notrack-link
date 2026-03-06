import { Theme } from '@radix-ui/themes';
import { renderToReadableStream } from 'react-dom/server';
import { App, AppProps } from './fe';

export async function RenderIndex(env: Env, props: AppProps): Promise<Response> {
	const assetBase = `/assets/${env.CF_VERSION_METADATA.tag || env.CF_VERSION_METADATA.id}`;
	const rs = await renderToReadableStream(
		<html>
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>notrack.link</title>
				<link rel="stylesheet" href={`${assetBase}/build.css`} />
			</head>
			<body>
				<div id="root">
					<Theme>
						<App {...props} />
					</Theme>
				</div>
			</body>
		</html>,
		{
			bootstrapScripts: [`${assetBase}/build.js`],
		}
	);
	return new Response(rs, {
		headers: { 'Content-Type': 'text/html' },
	});
}
