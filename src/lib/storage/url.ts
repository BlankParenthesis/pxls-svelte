import type { Writable, Subscriber, Unsubscriber } from "svelte/store";

const usedKeys = new Set();

type URLValue = string | null;

function readFragment(): { [k: string]: string } {
	const entries = document.location.hash.replace(/^#/, "")
		.split("&")
		.map(p => p.split("="))
		.filter(e => e.length === 2)
		.map(([k, v]) => [k, decodeURIComponent(v)]);

	return Object.fromEntries(entries);
}


function setFragment(key: string, value: URLValue) {
	const values = readFragment();
	
	if (value === null) {
		delete values[key];
	} else {
		values[key] = value;
	}

	const fragment = Object.entries(values)
		.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
		.join("&");
	
	const currentPath = document.location.origin + document.location.pathname;
	history.replaceState(null, "", new URL("#" + fragment, currentPath));
}

/**
 * Creates a store which maps values from the hash part of the current url.
 * @param key the key in the url hash that represents this store.
 * @param defaultValue the value that should be used if no value is set in the url at initialization.
 * @param hidden if true, the value will not remain in the url after being set.
 * @returns the store
 */
export function urlWritable(
	key: string,
	defaultValue: URLValue = null,
	hidden = false,
): Writable<string | null> {
	if (usedKeys.has(key)) {
		throw new Error(`"${key}" already has a url store`);
	}
	usedKeys.add(key);

	let value = readFragment()[key] || defaultValue;

	const subscriptions: Set<Subscriber<URLValue>> = new Set();

	const set = (v: URLValue) => {
		if (hidden) {
			setFragment(key, null);
		} else {
			setFragment(key, v);
		}
		value = v;
		subscriptions.forEach(s => s(value));
	};

	const update = (fn: (v: URLValue) => URLValue) => set(fn(value));

	const subscribe = (callback: Subscriber<URLValue>): Unsubscriber => {
		subscriptions.add(callback);
		callback(value);
		return () => subscriptions.delete(callback);
	};

	window.addEventListener("hashchange", () => {
		const value = readFragment()[key];
		if (value !== undefined || !hidden) {
			set(value);
		}
	});

	set(value);

	return { set, update, subscribe };
}