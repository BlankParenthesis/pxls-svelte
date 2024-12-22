import { writable, type Writable } from "svelte/store";

const usedKeys = new Set();

export interface PersistentWritable<T> extends Writable<T> {
	reset: () => void;
}

export function persistentWritable<T>(
	key: string,
	parser: (j: unknown) => T,
	defaultValue: T,
): PersistentWritable<T>;
export function persistentWritable<T>(
	key: string,
	parser: (j: unknown) => T,
): PersistentWritable<T | undefined>;
/**
 * Creates a store which keeps values after page load by using localstorage.
 * The contents can be reverted to the default if set to undefined,
 * @param key the key of this store
 * @param defaultValue the value that should be used if no value is present in storage
 * @returns the store
 */
export function persistentWritable<T>(
	key: string,
	parser: (j: unknown) => T,
	defaultValue?: undefined extends T ? T | undefined : T,
): PersistentWritable<T> {
	if (usedKeys.has(key)) {
		throw new Error(`"${key}" already has a persistent store`);
	}
	usedKeys.add(key);

	let value: T;
	const stored = JSON.parse(localStorage.getItem(key) as string) as unknown;
	try {
		value = parser(stored);
	} catch (e) {
		if (stored !== null) {
			console.warn("failed to load persistent value:", e);
		}
		value = defaultValue as T;
	}
	const store = writable(value);

	const { set, update, subscribe } = store;

	const newSet = (value: T) => {
		localStorage.setItem(key, JSON.stringify(value));
		set(value);
	};

	const reset = () => {
		localStorage.removeItem(key);
		set(defaultValue as T);
	};

	return { set: newSet, update, subscribe, reset };
}
