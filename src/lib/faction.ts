import { z } from "zod";
import { reference } from "./reference";
import { page } from "./page";
import type { Site } from "./site";
import type { Requester } from "./requester";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { collect } from "./util";
import { FactionMemberReference, FactionMembersPage, FactionMember } from "./factionmember";

export const RawFaction = z.object({
	"name": z.string(),
	"created_at": z.number().int().min(0).transform(unix => new Date(unix * 1000)),
	"size": z.number(),
});
export type RawFaction = z.infer<typeof RawFaction>;

export const FactionReference = reference(RawFaction);
export type FactionReference = z.infer<typeof FactionReference>;
export const FactionsPage = page(FactionReference);
export type FactionsPage = z.infer<typeof FactionsPage>;

export class Faction {
	constructor(
		private readonly site: Site,
		private readonly http: Requester,
		readonly name: string,
		readonly createdAt: Date,
		readonly size: number,
	) {}

	private currentMemberCache?: Readable<Promise<FactionMember | undefined>>;
	async currentMember(): Promise<Readable<Promise<FactionMember | undefined>>> {
		if (typeof this.currentMemberCache === "undefined") {
			const reference = await this.http.get("members/current")
				.then(f => {
					if (typeof f === "undefined") {
						return undefined;
					} else {
						return FactionMemberReference.parse(f);
					}
				});

			if(typeof reference !== "undefined") {
				this.currentMemberCache = this.site.factionMemberFromReference(reference);
			} else {
				this.currentMemberCache = writable(Promise.resolve(undefined));
			}
		}

		return this.currentMemberCache;
	}

	initCurrentMember(member: FactionMember) {
		if (typeof this.currentMemberCache === "undefined") {
			this.currentMemberCache = writable(Promise.resolve(member));
		}
	}

	private membersCache?: Writable<Promise<Array<Readable<Promise<FactionMember>>>>>;
	members(): Readable<Promise<Array<Readable<Promise<FactionMember>>>>> {
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
		// TODO: check permissions
		let members = await this.http.get("members")
			.then(j => FactionMembersPage.parse(j));
		while(true) {
			for (const reference of members.items) {
				yield this.site.factionMemberFromReference(reference);
			}
			if (members.next) {
				members = await this.http.get(members.next)
					.then(j => FactionMembersPage.parse(j));
			} else {
				break;
			}
		}
	}

	async join(): Promise<Readable<Promise<FactionMember>>> {
		const data = {
			user: await get(this.site.currentUser()),
			owner: false,
		};
		
		return await this.http.post(data, "members")
			.then(FactionMemberReference.parse)
			.then(r => this.site.factionMemberFromReference(r));
	}

	static parse(input: unknown): RawFaction {
		return RawFaction.parse(input);
	}
}