import { z } from "zod";
import type { Requester } from "./requester";
import type { Site } from "./site";
import { Role } from "./role";
import { collect, type Parser } from "./util";
import type { Readable } from "svelte/store";
import { writable, type Writable } from "svelte/store";
import { Faction } from "./faction";

export class User {
	constructor(
		private readonly site: Site,
		private readonly http: Requester,
		readonly name: string,
		readonly createdAt: Date,
	) {}

	private rolesCache?: Writable<Promise<Array<Readable<Promise<Role> | undefined>>>>;
	roles(): Readable<Promise<Array<Readable<Promise<Role> | undefined>>>> {
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
		const parse = this.site.parsers.rolesPage(this.http);
		let roles = await this.http.get("roles").then(parse);
		while (true) {
			for (const reference of roles.items) {
				yield reference.fetch();
			}
			if (roles.next) {
				roles = await this.http.get(roles.next).then(parse);
			} else {
				break;
			}
		}
	}

	private factionsCache?: Writable<Promise<Array<Readable<Promise<Faction> | undefined>>>>;
	factions(): Readable<Promise<Array<Readable<Promise<Faction> | undefined>>>> {
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
		const parse = this.site.parsers.factionsPage(this.http);
		let factions = await this.http.get("factions").then(parse);
		while (true) {
			for (const reference of factions.items) {
				yield reference.fetch();
			}
			if (factions.next) {
				factions = await this.http.get(factions.next).then(parse);
			} else {
				break;
			}
		}
	}

	/* eslint-disable camelcase */
	static parser(site: Site): Parser<User> {
		return (http: Requester) => z.object({
			"name": z.string(),
			"created_at": z.number().int().min(0).transform(unix => new Date(unix * 1000)),
		}).transform(({ name, created_at }) => {
			return new User(site, http, name, created_at);
		}).parse;
	}
}
