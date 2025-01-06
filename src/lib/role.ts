import { z } from "zod";
import type { Parser } from "./util";
import type { Requester } from "./requester";

export class Role {
	constructor(
		readonly name: string,
		readonly icon?: string,
	) {}

	static parser(): Parser<Role> {
		return (http: Requester) => z.object({
			"name": z.string(),
			"icon": z.string().optional(),
		}).transform(({ name, icon }) => {
			return new Role(name, icon);
		});
	}
}
