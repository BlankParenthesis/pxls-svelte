export class Cache {
	private readonly cache = new Map();
	private readonly base;

	constructor(
		location: URL,
	) {
		if (location.pathname.endsWith("/")) {
			this.base = location;
		} else {
			this.base = new URL(location.origin + location.pathname + "/");
		}
	}

	private resolve(path: string): URL {
		return new URL(path, this.base);
	}

	get<T>(path: string, mapper: (json: unknown) => T): Promise<T> {
		const url = this.resolve(path);
		if (!this.cache.has(url)) {
			const value = fetch(url)
				.then(r => r.json())
				.then(mapper);
			this.cache.set(url, value);
		}
		return this.cache.get(url);
	}

	invalidate(path: string) {
		this.cache.delete(this.resolve(path));
	}
}