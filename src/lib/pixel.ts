import { z } from "zod";
import type { Readable } from "svelte/store";
import { type User } from "./user";
import type { Parser } from "./util";
import type { Requester } from "./requester";
import type { Reference } from "./reference";

export class Pixel  {
	constructor(
		readonly position: number,
		readonly color: number,
		readonly modified: Date,
		readonly user?: Readable<Promise<User>>,
	) {}

	static parser(boardCreated: Date, sub: Parser<Reference<User>>): Parser<Pixel> {
		const epoch = boardCreated.valueOf();
		return (http: Requester) => z.object({
			position: z.number().int().min(0),
			color: z.number().int().min(0),
			modified: z.number().int().min(0).transform(pixel => new Date(epoch + pixel * 1000)),
			user: z.unknown(),
		}).transform(({position, color, modified, user}) => {
			const parse = sub(http);
			const parsedUser = z.unknown().transform(parse).optional().parse(user);
			return new Pixel(position, color, modified, parsedUser?.get());
		}).parse;
	}
}