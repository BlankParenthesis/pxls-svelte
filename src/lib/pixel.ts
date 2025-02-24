import { z } from "zod";
import type { Readable } from "svelte/store";
import { type User } from "./user";
import type { Parser } from "./util";
import type { Requester } from "./requester";
import type { Reference } from "./reference";
import type { BoardInfo } from "./board/info";

export class Pixel {
	constructor(
		readonly position: number,
		readonly color: number,
		readonly modified: Date,
		readonly user?: Readable<Promise<User> | undefined>,
	) {}

	static parser(
		access: Readable<Promise<Set<string>>>,
		info: Readable<BoardInfo>,
		sub: Parser<Reference<User>>,
		parseTime: (time: number) => Date,
	): Parser<Pixel | undefined> {
		let epoch = 0;
		info.subscribe(i => epoch = i.createdAt.valueOf());
		let canLookupUser = false;
		access.subscribe(p => p.then(perms => canLookupUser = perms.has("users.get")));
		return (http: Requester) => z.object({
			position: z.number().int().min(0),
			color: z.number().int().min(0),
			modified: z.number().int().min(0).transform(pixel => parseTime(epoch / 1000 + pixel)),
			user: z.unknown(),
		}).transform(({ position, color, modified, user }, context) => {
			const { success, data, error } = sub(http).optional().safeParse(user);
			if (success) {
				let parsedUser: Readable<Promise<User> | undefined> | undefined;
				if (canLookupUser) {
					parsedUser = data?.fetch();
				} else {
					parsedUser = data?.get();
				}
				return new Pixel(position, color, modified, parsedUser);
			} else {
				for (const issue of error.errors) {
					context.addIssue(issue);
				}
				return z.NEVER;
			}
		}).or(z.undefined());
	}
}
