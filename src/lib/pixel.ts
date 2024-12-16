import { z } from "zod";
import type { Readable } from "svelte/store";
import { type User } from "./user";
import type { Parser } from "./util";
import type { Requester } from "./requester";
import type { Reference } from "./reference";
import type { BoardInfo } from "./board/info";

export class Pixel  {
	constructor(
		readonly position: number,
		readonly color: number,
		readonly modified: Date,
		readonly user?: Readable<Promise<User>>,
	) {}

	static parser(
		access: Readable<Promise<Set<string>>>,
		info: Readable<BoardInfo>,
		sub: Parser<Reference<User>>,
	): Parser<Pixel | undefined> {
		let epoch = 0;
		info.subscribe(i => epoch = i.createdAt.valueOf());
		let canLookupUser = false;
		access.subscribe(p => p.then(perms => canLookupUser = perms.has("users.get")));
		return (http: Requester) => z.object({
			position: z.number().int().min(0),
			color: z.number().int().min(0),
			modified: z.number().int().min(0).transform(pixel => new Date(epoch + pixel * 1000)),
			user: z.unknown(),
		}).transform(({position, color, modified, user}) => {
			const parse = sub(http);
			const parsedReference = z.unknown().transform(parse).optional().parse(user);
			let parsedUser: Readable<Promise<User>> | undefined;
			if (canLookupUser) {
				parsedUser = parsedReference?.fetch();
			} else {
				parsedUser = parsedReference?.get();
			}
			return new Pixel(position, color, modified, parsedUser);
		}).or(z.undefined()).parse;
	}
}
