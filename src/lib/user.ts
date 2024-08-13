import { z } from "zod";
import type { Requester } from "./requester";
import type { Site } from "./site";
import { reference } from "./reference";
import { Role, RolesPage } from "./role";
import { collect } from "./util";
import type { Readable } from "svelte/motion";
import { writable, type Writable } from "svelte/store";
import { FactionsPage, type Faction } from "./faction";

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

	private factionsCache?: Writable<Promise<Array<Readable<Promise<Faction>>>>>;
	factions(): Readable<Promise<Array<Readable<Promise<Faction>>>>> {
		if (typeof this.factionsCache === "undefined") {
			this.factionsCache = writable(collect(this.fetchFactions()));
		}

		return this.factionsCache;
	}

	updatefactions() {
		const newFactions = collect(this.fetchFactions());
		if (typeof this.factionsCache === "undefined") {
			this.factionsCache = writable(newFactions);
		} else {
			this.factionsCache.set(newFactions);
		}
	}

	async *fetchFactions() {
		// TODO: check permissions
		let factions = await this.http.get("factions")
			.then(j => FactionsPage.parse(j));
		while(true) {
			for (const reference of factions.items) {
				let faction: Readable<Promise<Faction>>;
				if (typeof reference.view !== "undefined") {
					faction = this.site.cacheFaction(reference.uri, Promise.resolve(reference.view));
				} else {
					faction = this.site.faction(reference.uri);
				}

				yield faction;
			}
			if (factions.next) {
				factions = await this.http.get(factions.next)
					.then(j => FactionsPage.parse(j));
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