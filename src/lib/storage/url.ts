import type { Writable, Subscriber, Unsubscriber } from "svelte/store";
import { getFragment, setFragment } from "../util";

const existingStores = new Map();

type URLValue = string | null;

function setFragmentValue(key: string, value: URLValue) {
	const values = getFragment();

	if (value === null) {
		delete values[key];
	} else {
		values[key] = value;
	}

	setFragment(values);
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
	if (existingStores.has(key)) {
		// TODO: this probably isn't the safest, but slight brokenness is probably better than the page no longer working
		// throw new Error(`"${key}" already has a url store`);
		return existingStores.get(key);
	}

	let value = getFragment()[key] || defaultValue;

	const subscriptions: Set<Subscriber<URLValue>> = new Set();

	const set = (v: URLValue) => {
		if (hidden) {
			setFragmentValue(key, null);
		} else {
			setFragmentValue(key, v);
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
		const value = getFragment()[key];
		if (value !== undefined || !hidden) {
			set(value);
		}
	});

	set(value);

	const store = { set, update, subscribe };
	existingStores.set(key, store);
	return store;
}
