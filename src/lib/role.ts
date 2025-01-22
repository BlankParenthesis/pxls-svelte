import { z } from "zod";
import type { Parser } from "./util";
import type { Requester } from "./requester";
import type { Updatable } from "./cache";

export class Role implements Updatable {
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

	update(newValue: this): this {
		return newValue;
	}
}
