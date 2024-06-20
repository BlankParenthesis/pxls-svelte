import { writable, type Writable } from "svelte/store";

const usedKeys = new Set();

/**
 * Creates a store which keeps values after page load by using localstorage.
 * The contents can be reverted to the default if set to null,
 * @param key the key of this store
 * @param defaultValue the value that should be used if no value is present in storage
 * @returns the store
 */
export function persistentWritable<T>(key: string, defaultValue: T): Writable<T | null> {
	if (usedKeys.has(key)) {
		throw new Error(`"${key}" already has a persistent store`);
	}
	usedKeys.add(key);

	let value = JSON.parse(localStorage.getItem(key) as string);
	if (value === null) {
		value = defaultValue;
	}
	const store: Writable<T> = writable(value);

	const { set, update, subscribe } = store;

	const newSet = (value: T | null) => {
		if (value === null) {
			localStorage.removeItem(key);
			set(defaultValue);
		} else {
			localStorage.setItem(key, JSON.stringify(value));
			set(value);
		}
	};

	return { set: newSet, update, subscribe };
}