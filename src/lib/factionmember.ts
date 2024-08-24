import { z } from "zod";
import { page } from "./page";
import { reference } from "./reference";
import type { Requester } from "./requester";

// TODO: this is here to remove circular dep for now
const RawUser = z.object({
	"name": z.string(),
	"created_at": z.number().int().min(0).transform(unix => new Date(unix * 1000)),
});
type RawUser = z.infer<typeof RawUser>;

export const RawFactionMember = z.object({
	"join_intent": z.object({
		"member": z.boolean(),
		"faction": z.boolean(),
	}),
	"owner": z.boolean(),
	"user": reference(RawUser).optional(),
});
export type RawFactionMember = z.infer<typeof RawFactionMember>;

export const FactionMemberReference = reference(RawFactionMember);
export type FactionMemberReference = z.infer<typeof FactionMemberReference>;
export const FactionMembersPage = page(FactionMemberReference);
export type FactionMembersPage = z.infer<typeof FactionMembersPage>;

export enum MemberStatus {
	Invited,
	Applied,
	Joined,
	Owned,
	None
}

export class FactionMember {
	constructor(
		private readonly http: Requester,
		readonly joinIntent: { member: boolean, faction: boolean },
		readonly owner: boolean,
		readonly user?: string,
	) {}

	get status(): MemberStatus {
		if (this.owner) {
			return MemberStatus.Owned;
		}

		if (this.joinIntent.member) {
			if (this.joinIntent.faction) {
				return MemberStatus.Joined;
			} else {
				return MemberStatus.Applied;
			}
		} else {
			if (this.joinIntent.faction) {
				return MemberStatus.Invited;
			} else {
				return MemberStatus.None;
			}
		}
	}

	leave() {
		this.http.delete();
	}

	static parse(input: unknown): RawFactionMember {
		return RawFactionMember.parse(input);
	}

	static default(): RawFactionMember {
		return {
			"owner": false,
			"join_intent": {
				"faction": false,
				"member": false,
			},
		};
	}
}