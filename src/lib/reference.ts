import { z } from "zod";
import { Cache, type Updatable } from "./cache";
import type { Parser } from "./util";
import type { Requester } from "./requester";
import type { Readable } from "svelte/store";

export class Reference<T extends Updatable> {
	private constructor(
		private readonly cache: Cache<T>,
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

	fetch(): Readable<Promise<T> | undefined> {
		if (typeof this.view === "undefined") {
			return this.cache.fetch(this.uri);
		} else {
			// FIXME: if this is reference is held onto, this can be called
			// later to overwrite new data with old.
			return this.cache.update(this.uri, Promise.resolve(this.view));
		}
	}

	static parser<T extends Updatable>(
		cache: Cache<T>,
		sub: Parser<T>,
	): Parser<Reference<T>> {
		return (http: Requester) => z.object({
			uri: z.string(),
			view: z.unknown().transform(v => v ?? undefined),
		}).transform(({ uri, view }, context) => {
			const subHttp = http.subpath(uri);
			const parse = sub(subHttp);
			const { success, data, error } = z.unknown().pipe(parse).optional().safeParse(view);
			if (success) {
				return new Reference(cache, uri, data);
			} else {
				for (const issue of error.errors) {
					context.addIssue(issue);
				}
				return z.NEVER;
			}
		});
	}
}
