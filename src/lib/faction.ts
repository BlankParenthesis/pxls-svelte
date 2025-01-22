import { z } from "zod";
import type { Site } from "./site";
import type { Requester } from "./requester";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { collect, type Parser } from "./util";
import { FactionMember } from "./factionmember";
import type { Updatable } from "./cache";

export class Faction implements Updatable {
	constructor(
		private readonly site: Site,
		private readonly http: Requester,
		readonly name: string,
		readonly createdAt: Date,
		readonly size: number,
	) {}

	get uri() {
		return this.http.baseURL;
	}

	private currentMemberCache?: Readable<Promise<FactionMember | undefined> | undefined>;
	async currentMember(): Promise<Readable<Promise<FactionMember | undefined> | undefined>> {
		if (typeof this.currentMemberCache === "undefined") {
			const parse = this.site.parsers.factionMemberReference(this.http).parse;
			const reference = await this.http.get("members/current")
				.then((data) => {
					if (typeof data === "undefined") {
						return writable(Promise.resolve(undefined));
					} else {
						return parse(data).fetch();
					}
				});

			this.currentMemberCache = reference;
		}

		return this.currentMemberCache;
	}

	initCurrentMember(member: FactionMember) {
		if (typeof this.currentMemberCache === "undefined") {
			this.currentMemberCache = writable(Promise.resolve(member));
		}
	}

	private membersCache?: Writable<Promise<Array<Readable<Promise<FactionMember> | undefined>>>>;
	members(): Readable<Promise<Array<Readable<Promise<FactionMember> | undefined>>>> {
		if (typeof this.membersCache === "undefined") {
			this.membersCache = writable(collect(this.fetchMembers()));
		}

		return this.membersCache;
	}

	updateMembers() {
		const newMembers = collect(this.fetchMembers());
		if (typeof this.membersCache === "undefined") {
			this.membersCache = writable(newMembers);
		} else {
			this.membersCache.set(newMembers);
		}
	}

	async *fetchMembers() {
		const parse = this.site.parsers.factionMembersPage(this.http).parse;
		// TODO: check permissions
		let members = await this.http.get("members").then(parse);
		while (true) {
			for (const reference of members.items) {
				yield reference.fetch();
			}
			if (members.next) {
				members = await this.http.get(members.next).then(parse);
			} else {
				break;
			}
		}
	}

	async join(): Promise<Readable<Promise<FactionMember> | undefined>> {
		const data = {
			user: (await get(this.site.currentUser())).uri,
			owner: false,
		};

		const parse = this.site.parsers.factionMemberReference(this.http).parse;

		return await this.http.post(data, "members")
			.then(parse)
			.then(r => r.fetch());
	}

	/* eslint-disable camelcase */
	static parser(site: Site): Parser<Faction> {
		return (http: Requester) => z.object({
			name: z.string(),
			created_at: z.number().int().min(0).transform(unix => new Date(unix * 1000)),
			size: z.number(),
		}).transform(({ name, created_at, size }) => {
			return new Faction(site, http, name, created_at, size);
		});
	}

	update(newValue: this): this {
		newValue.currentMemberCache = this.currentMemberCache;
		newValue.membersCache = this.membersCache;
		return newValue;
	}
}
