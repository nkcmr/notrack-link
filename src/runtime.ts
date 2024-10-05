export function isCloudflare(): boolean {
	return typeof Cloudflare !== 'undefined';
}

export function isBrowser(): boolean {
	//@ts-ignore
	return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}
