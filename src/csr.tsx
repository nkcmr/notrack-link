import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './fe';

hydrateRoot(
	document.querySelector('#root')!,
	<App
		getLocation={() => {
			return new URL(window.location.href);
		}}
	/>
);
// const root = createRoot(document.querySelector('#root')!);
// root.render(<App />);
