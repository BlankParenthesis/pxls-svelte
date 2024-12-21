import { z } from "zod";
import { Cache } from "./cache";
import type { Parser } from "./util";
import type { Requester } from "./requester";
import type { Readable } from "svelte/store";

export class Reference<T> {
	private constructor(
		private readonly cache: Cache<Promise<T>>,
		readonly uri: string,
		private readonly view?: T,
	) {}

	get(): Readable<Promise<T> | undefined> {
		if (typeof this.view === "undefined") {
			return this.cache.get(this.uri);
		} else {
			return this.cache.update(this.uri, Promise.resolve(this.view));
		}
	}

	fetch(): Readable<Promise<T>| undefined> {
		if (typeof this.view === "undefined") {
			return this.cache.fetch(this.uri);
		} else {
			// FIXME: if this is reference is held onto, this can be called 
			// later to overwrite new data with old.
			return this.cache.update(this.uri, Promise.resolve(this.view));
		}
	}

	static parser<T>(
		cache: Cache<Promise<T>>,
		sub: Parser<T>,
	): Parser<Reference<T>> {
		return (http: Requester) => z.object({
			uri: z.string(),
			view: z.unknown().transform(v => v ?? undefined),
		}).transform(({ uri, view }) => {
			const subHttp = http.subpath(uri);
			const parse = sub(subHttp);
			const parsed = z.unknown().transform(parse).optional().parse(view);
			return new Reference(cache, uri, parsed);
		}).parse;
	}
}
