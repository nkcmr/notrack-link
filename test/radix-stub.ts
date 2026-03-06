// Stub for @radix-ui/themes used only in the Workers test environment,
// which cannot resolve browser/DOM packages like react-remove-scroll.
import { createElement, Fragment } from 'react';

function passthrough({ children }: { children?: any }) {
	return createElement(Fragment, null, children);
}

export const Theme = passthrough;
export const Box = passthrough;
export const Flex = passthrough;
export const Container = passthrough;
export const Heading = passthrough;
export const Text = passthrough;
export const Link = passthrough;
export const Code = passthrough;
export const Badge = passthrough;
export const Spinner = passthrough;
export const Callout = {
	Root: passthrough,
	Text: passthrough,
};
