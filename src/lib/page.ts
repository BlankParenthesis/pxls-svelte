import { z } from "zod";
import type { Parser } from "./util";
import type { Requester } from "./requester";

export class Page<T> {
	private constructor(
		readonly items: Array<T>,
		readonly next?: string | null,
		readonly previous?: string | null,
	) {}

	static parser<T>(sub: Parser<T>): Parser<Page<T>> {
		return (http: Requester) => z.object({
			items: z.array(z.unknown()),
			next: z.string().nullable().optional(),
			previous: z.string().nullable().optional(),
		}).transform(({ items, next, previous }) => {
			const parse = sub(http);
			return new Page(items.map(parse), next, previous);
		}).parse;
	}
}
