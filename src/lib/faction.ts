import { z } from "zod";
import type { Site } from "./site";
import type { Requester } from "./requester";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { type Parser } from "./util";
import { FactionMember } from "./factionmember";
import { Cache, type Updatable } from "./cache";
import { Reference } from "./reference";
import { Page } from "./page";

const CurrentFactionMember = (factionMemberParser: Parser<FactionMember>) => {
	return (http: Requester) => z.object({
		uri: z.string(),
		view: z.unknown(),
	}).transform(({ uri, view }) => ({
		uri,
		view: z.unknown().pipe(factionMemberParser(http.subpath(uri))).optional().parse(view),
	}));
};
type CurrentFactionMember = z.infer<ReturnType<ReturnType<typeof CurrentFactionMember>>>;

export class Faction implements Updatable {
	private parsers: {
		factionMemberReference: Parser<Reference<FactionMember>>;
		factionMembersPage: Parser<Page<Reference<FactionMember>>>;
		currentFactionMember: Parser<CurrentFactionMember>;
	};

	constructor(
		private readonly site: Site,
		private readonly http: Requester,
		readonly name: string,
		readonly createdAt: Date,
		readonly size: number,
	) {
		const factionMemberReference = Reference.parser(this.members, site.parsers.factionMember);
		const factionMembersPage = Page.parser(factionMemberReference);
		const currentFactionMember = CurrentFactionMember(site.parsers.factionMember);
		this.parsers = { factionMemberReference, factionMembersPage, currentFactionMember };
	}

	get uri() {
		return this.http.baseURL;
	}

	// TODO: wipe on user change
	private currentMemberCache?: Writable<Promise<string | undefined>>;
	currentMember(): Readable<Promise<string | undefined>> {
		if (typeof this.currentMemberCache === "undefined") {
			const reference = this.http.get("members/current")
				.then((data) => {
					if (typeof data === "undefined") {
						return undefined;
					} else {
						const parse = this.parsers.currentFactionMember(this.http).parse;
						return parse(data).uri;
					}
				});

			this.currentMemberCache = writable(reference);
		}

		return this.currentMemberCache;
	}

	updateCurrentMember(currentMember: string) {
		if (typeof this.currentMemberCache === "undefined") {
			this.currentMemberCache = writable(Promise.resolve(currentMember));
		} else {
			this.currentMemberCache.set(Promise.resolve(currentMember));
		}
	}

	private membersCache = new Cache((location) => {
		const http = this.http.subpath(location);
		const parse = this.site.parsers.factionMember(http).parse;
		return this.http.get(location).then(parse);
	});

	get members() {
		return this.membersCache;
	}

	async *fetchMembers() {
		const parse = this.parsers.factionMembersPage(this.http).parse;
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

		const parse = this.parsers.factionMemberReference(this.http).parse;

		return await this.http.post(data, "members")
			.then(parse)
			.then(r => r.fetch());
	}

	delete(): Promise<void> {
		return this.http.delete();
	}

	/* eslint-disable camelcase */
	static parser(site: Site, parseTime: (time: number) => Date): Parser<Faction> {
		return (http: Requester) => z.object({
			name: z.string(),
			created_at: z.number().int().min(0).transform(parseTime),
			size: z.number(),
		}).transform(({ name, created_at, size }) => {
			return new Faction(site, http, name, created_at, size);
		});
	}

	update(newValue: this): this {
		newValue.membersCache = this.members;
		newValue.currentMemberCache = this.currentMemberCache;
		return newValue;
	}
}
