import '@radix-ui/themes/styles.css';
import React from 'react';
import { Theme } from '@radix-ui/themes';
import { hydrateRoot } from 'react-dom/client';
import { App } from './fe';

hydrateRoot(
	document.querySelector('#root')!,
	<Theme>
		<App
			getLocation={() => {
				return new URL(window.location.href);
			}}
		/>
	</Theme>
);
