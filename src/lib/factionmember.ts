import { z } from "zod";
import type { Requester } from "./requester";
import type { Parser } from "./util";
import type { Reference } from "./reference";
import type { User } from "./user";

export enum MemberStatus {
	Invited,
	Applied,
	Joined,
	Owned,
	None,
}

export class FactionMember {
	constructor(
		private readonly http: Requester,
		readonly joinIntent: { member: boolean; faction: boolean },
		readonly owner: boolean,
		readonly user?: Reference<User>,
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

	/* eslint-disable camelcase */
	static parser(sub: Parser<Reference<User>>): Parser<FactionMember> {
		return (http: Requester) => z.object({
			"join_intent": z.object({
				"member": z.boolean(),
				"faction": z.boolean(),
			}),
			"owner": z.boolean(),
			"user": z.unknown(),
		}).transform(({ join_intent, owner, user }, context) => {
			const parse = sub(http);
			const { success, data, error } = z.unknown().pipe(parse).optional().safeParse(user);

			if (success) {
				return new FactionMember(http, join_intent, owner, data);
			} else {
				for (const issue of error.errors) {
					context.addIssue(issue);
				}
				return z.NEVER;
			}
		});
	}
}
