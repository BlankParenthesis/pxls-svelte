import { writable, type Readable, type Writable } from "svelte/store";

export class Cache<V, K = string> {
	constructor(
		private readonly generate: (key: K) => V,
	) {}

	private readonly map: Map<K, Writable<V>> = new Map();

	get(key: K): Readable<V> | undefined {
		return this.map.get(key);
	}

	fetch(key: K): Readable<V> {
		const value = this.map.get(key);
		if (typeof value === "undefined") {
			const newValue = writable(this.generate(key));
			this.map.set(key, newValue);
			return newValue;
		} else {
			return value;
		}
	}

	update(key: K, updatedValue: V): Readable<V> {
		const value = this.map.get(key);
		if (typeof value === "undefined") {
			const newValue = writable(updatedValue);
			this.map.set(key, newValue);
			return newValue;
		} else {
			value.set(updatedValue);
			return value;
		}
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