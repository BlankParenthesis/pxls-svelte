import { z } from "zod";
import type { Requester } from "./requester";
import type { Site } from "./site";
import { Role } from "./role";
import { collect, type Parser } from "./util";
import type { Readable } from "svelte/store";
import { get, writable, type Writable } from "svelte/store";
import { Faction } from "./faction";
import { FactionMember } from "./factionmember";
import { type Updatable } from "./cache";
import type { Reference } from "./reference";

export const FactionMembership = function (
	factionParser: Parser<Reference<Faction>>,
	memberParser: Parser<FactionMember>,
) {
	return (http: Requester) => z.object({
		faction: z.unknown().pipe(factionParser(http)),
		member: z.object({
			uri: z.string(),
			view: z.unknown().optional(),
		}),
	}).transform(({ faction, member }) => {
		get(faction.get())?.then((f) => {
			if (typeof member.view !== "undefined") {
				const view = memberParser(http.subpath(member.uri)).parse(member.view);
				f.members.update(member.uri, Promise.resolve(view));
			}
		});

		return { faction, member: member.uri };
	});
};
export type FactionMembership = z.infer<ReturnType<ReturnType<typeof FactionMembership>>>;

export class User implements Updatable {
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
		const parse = this.site.parsers.rolesPage(this.http).parse;
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

	private factionsCache?: Writable<Promise<Array<FactionMembership>>>;
	factions(): Readable<Promise<Array<FactionMembership>>> {
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
		const parse = this.site.parsers.factionMembershipPage(this.http).parse;
		let currentFactions = await this.http.get("factions").then(parse);
		while (true) {
			for (const reference of currentFactions.items) {
				yield reference;
			}
			if (currentFactions.next) {
				currentFactions = await this.http.get(currentFactions.next).then(parse);
			} else {
				break;
			}
		}
	}

	/* eslint-disable camelcase */
	static parser(site: Site, parseTime: (time: number) => Date): Parser<User> {
		return (http: Requester) => z.object({
			"name": z.string(),
			"created_at": z.number().int().min(0).transform(parseTime),
		}).transform(({ name, created_at }) => {
			return new User(site, http, name, created_at);
		});
	}

	update(newValue: this): this {
		newValue.rolesCache = this.rolesCache;
		newValue.factionsCache = this.factionsCache;
		return newValue;
	}
}
