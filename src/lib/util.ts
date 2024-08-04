import { Vec2, type Attribute } from "ogl";

export function randomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

export function base64encode(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

export function base64urlsafe(bytes: Uint8Array): string {
	return base64encode(bytes)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
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

/**
 * creates a function that adds the key and value to an object passed into it
 * @param key the key to insert when the function is called
 * @param value the value of the key
 * @returns the function which adds the key-value pair to the passed argument
 */
export function tag<K extends string, V,>(key: K, value: V) {
	function record<K extends string, V>(key: K, value: V): { [prop in K]: V };
	function record<K extends string, V>(key: K, value: V) {
		return { [key]: value };
	}

	const obj2 = record(key, value);

	return function<T extends { [P in keyof T]: unknown }>(obj: T) { 
		return {...obj, ...obj2 };
	};
}

/**
 * resolves an async generator of items to a single promise resolving to an 
 * array of all generated items.
 * @param gen the async generator to collect
 * @returns a promise to an array of all yielded items
 */
export async function collect<T>(gen: AsyncGenerator<T>): Promise<Array<T>> {
	const collection = [];
	for await(const i of gen) {
		collection.push(i);
	}
	return collection;
}

export interface Instanceable {
	maxParallelism: number;
}


/** 
 * @returns a vector which normalizes the larger of @width and @height to the other
 */
export function ratio(width: number, height: number): Vec2 {
	if (width > height) {
		return new Vec2(1, width / height);
	} else {
		return new Vec2(height / width, 1);
	}
}

/**
 * updates the contents of and ogl attribute.
 * @param attribute the ogl instance attribute to update.
 * @param data the data to set the attribute to.
 */
export function updateAttribute(attribute: Attribute, data: Array<Vec2 | number>) {
	attribute.data = Float32Array.from(data.flat());
	attribute.count = data.length;
	attribute.needsUpdate = true;
}

export interface GameState {
	selectedColor?: number;
}