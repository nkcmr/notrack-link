import { renderToReadableStream } from 'react-dom/server';
import { App, AppProps } from './fe';

export async function RenderIndex(env: Env, props: AppProps): Promise<Response> {
	const rs = await renderToReadableStream(
		<html>
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>notrack.link</title>
			</head>
			<body>
				<div id="root">
					<App {...props} />
				</div>
			</body>
		</html>,
		{
			bootstrapScripts: [`/assets/${env.CF_VERSION_METADATA.tag || env.CF_VERSION_METADATA.id}/build.js`],
		}
	);
	return new Response(rs, {
		headers: { 'Content-Type': 'text/html' },
	});
}
