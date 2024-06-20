/**
 * Wait until the page is about to render.
 * NOTE: Awaiting after this point will likely miss the frame.
 */
export function nextFrame(): Promise<DOMHighResTimeStamp> {
	return new Promise(resolve => requestAnimationFrame(resolve));
}

export function randomString(length: number = 20): string {
	const choices = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
	return Array(length).fill(null).map(() => {
		const index = Math.floor(Math.random() * choices.length);;
		return choices[index];
	}).join("");
}

/**
 * helper function for handling url joining with special handling for trailing slashes.
 * @param base the base url
 * @param path the subpath to append
 * @returns the path appended to the base
 */
export function resolveURL(base: URL, path: string): URL {
	if (base.pathname.endsWith("/")) {
		return new URL(path, base);
	} else {
		return new URL(path, base.origin + base.pathname + "/");
	}
}

type FragmentMap = { [k: string]: string };
/**
 * @returns an object containing th key value pairs from the current url fragment
 */
export function getFragment(): FragmentMap {
	const entries = document.location.hash.replace(/^#/, "")
		.split("&")
		.map(p => p.split("="))
		.filter(e => e.length === 2)
		.map(([k, v]) => [k, decodeURIComponent(v)]);

	return Object.fromEntries(entries);
}
/**
 * @param values an object containing the key value pairs to set in the current url fragment
 */
export function setFragment(values: FragmentMap) {
	const fragment = Object.entries(values)
		.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
		.join("&");
	
	const currentPath = document.location.origin + document.location.pathname;
	if (fragment.length === 0) {
		history.replaceState(null, "", new URL(currentPath));
	} else {
		history.replaceState(null, "", new URL("#" + fragment, currentPath));
	}
}
