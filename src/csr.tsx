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
