import { z } from "zod";
import type { Parser } from "./util";
import type { Requester } from "./requester";

export class UserCount {
	constructor(
		readonly active: number,
		readonly idleTimeout: number,
	) {}

	/* eslint-disable camelcase */
	static parser(): Parser<UserCount> {
		return (http: Requester) => z.object({
			"active": z.number().int().min(0),
			"idle_timeout": z.number().int().min(0),
		}).transform(({ active, idle_timeout }) => {
			return new UserCount(active, idle_timeout);
		}).parse;
	}
}
