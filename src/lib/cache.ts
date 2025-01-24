import { writable, type Readable, type Writable } from "svelte/store";

export interface Updatable {
	update(newValue: this): this;
}

export class Cache<V extends Updatable, K = string> {
	constructor(
		private readonly generate: (key: K) => Promise<V>,
	) {}

	private readonly map: Map<K, Writable<Promise<V> | undefined>> = new Map();

	get(key: K): Readable<Promise<V> | undefined> {
		const value = this.map.get(key);
		if (typeof value === "undefined") {
			const newValue = writable(undefined);
			this.map.set(key, newValue);
			return newValue;
		}
		return value;
	}

	fetch(key: K): Readable<Promise<V> | undefined> {
		const value = this.map.get(key);
		if (typeof value === "undefined") {
			const newValue = writable(this.generate(key));
			this.map.set(key, newValue);
			return newValue;
		}
		return value;
	}

	update(key: K, updatedValue: Promise<V>): Readable<Promise<V> | undefined> {
		const value = this.map.get(key);
		if (typeof value === "undefined") {
			const newValue = writable(updatedValue);
			this.map.set(key, newValue);
			return newValue;
		} else {
			value.update((oldValue) => {
				if (typeof oldValue === "undefined") {
					return updatedValue;
				} else {
					return Promise.all([oldValue, updatedValue])
						.then(([oldValue, updatedValue]) => {
							return oldValue.update(updatedValue);
						});
				}
			});
			return value;
		}
	}

	delete(key: K): Promise<V> | undefined {
		const value = this.map.get(key);
		let cachedValue = undefined;
		if (typeof value !== "undefined") {
			value.update((old) => {
				cachedValue = old;
				return undefined;
			});
		}
		return cachedValue;
	}
}

export class CacheOnce<V, K = string> {
	constructor(
		private readonly generate: (key: K) => V,
	) {}

	private readonly map: Map<K, V> = new Map();

	get(key: K): V {
		const value = this.map.get(key);
		if (typeof value === "undefined") {
			const newValue = this.generate(key);
			this.map.set(key, newValue);
			return newValue;
		} else {
			return value;
		}
	}
}
