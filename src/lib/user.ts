import { z } from "zod";
import type { Requester } from "./requester";
import type { Site } from "./site";
import { reference } from "./reference";
import { Role, RolesPage } from "./role";
import { collect } from "./util";
import type { Readable } from "svelte/motion";
import { writable, type Writable } from "svelte/store";

export const RawUser = z.object({
	"name": z.string(),
	"created_at": z.number().int().min(0).transform(unix => new Date(unix * 1000)),
});
export type RawUser = z.infer<typeof RawUser>;

export class User  {
	constructor(
		private readonly site: Site,
		private readonly http: Requester,
		readonly name: string,
		readonly createdAt: Date,
	) {}

	private rolesCache?: Writable<Promise<Array<Readable<Promise<Role>>>>>;
	roles(): Readable<Promise<Array<Readable<Promise<Role>>>>> {
		if (typeof this.rolesCache === "undefined") {
			this.rolesCache = writable(collect(this.fetchRoles()));
		}

		return this.rolesCache;
	}

	updateRoles() {
		const newRoles = collect(this.fetchRoles());
		if (typeof this.rolesCache === "undefined") {
			this.rolesCache = writable(newRoles);
		} else {
			this.rolesCache.set(newRoles);
		}
	}

	async *fetchRoles() {
		// TODO: check permissions
		let roles = await this.http.get("roles")
			.then(j => RolesPage.parse(j));
		while(true) {
			for (const reference of roles.items) {
				let role: Readable<Promise<Role>>;
				if (typeof reference.view !== "undefined") {
					role = this.site.cacheRole(reference.uri, Promise.resolve(reference.view));
				} else {
					role = this.site.role(reference.uri);
				}

				yield role;
			}
			if (roles.next) {
				roles = await this.http.get(roles.next)
					.then(j => RolesPage.parse(j));
			} else {
				break;
			}
		}
	}

	static parse(input: unknown): RawUser {
		return RawUser.parse(input);
	}
}
export const UserReference = reference(RawUser);