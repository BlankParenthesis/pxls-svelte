import { z, type ZodType, type ZodTypeDef } from "zod";
import type { Reference } from "./reference";
import type { User } from "./user";
import type { Faction } from "./faction";
import type { FactionMember } from "./factionmember";
import type { Requester } from "./requester";
import type { Parser } from "./util";
import { Permissions } from "./permissions";
import { get } from "svelte/store";

const UserUpdated = (sub: ZodType<Reference<User>, ZodTypeDef, unknown>) => z.object({
	type: z.literal("user-updated"),
	user: z.unknown().pipe(sub),
});

const UserRolesUpdated = z.object({
	type: z.literal("user-roles-updated"),
	user: z.string(),
});

const FactionCreated = (sub: ZodType<Reference<Faction>, ZodTypeDef, unknown>) => z.object({
	type: z.literal("faction-created"),
	faction: z.unknown().pipe(sub),
});

const FactionUpdated = (sub: ZodType<Reference<Faction>, ZodTypeDef, unknown>) => z.object({
	type: z.literal("faction-updated"),
	faction: z.unknown().pipe(sub),
});

const FactionDeleted = z.object({
	type: z.literal("faction-deleted"),
	faction: z.string(),
});

/* eslint-disable camelcase */
const AccessUpdate = z.object({
	type: z.literal("access-update"),
	user_id: z.string().optional(),
	permissions: Permissions,
});
/* eslint-enable camelcase */

const FactionMemberUpdated = (
	context: Requester,
	factionParser: Parser<Reference<Faction>>,
	memberParser: Parser<FactionMember>,
) => z.object({
	type: z.literal("faction-member-updated"),
	faction: z.unknown().pipe(factionParser(context)),
	member: z.object({
		uri: z.string(),
		view: z.unknown().optional(),
	}),
}).transform(({ type, faction, member }) => {
	get(faction.get())?.then((f) => {
		if (typeof member.view !== "undefined") {
			const view = memberParser(context.subpath(member.uri)).parse(member.view);
			f.members.update(member.uri, Promise.resolve(view));
		}
	});

	return { type, faction, member: member.uri };
});

export function parser(context: Requester, parsers: {
	userReference: Parser<Reference<User>>;
	factionReference: Parser<Reference<Faction>>;
	factionMember: Parser<FactionMember>;
}) {
	return UserUpdated(parsers.userReference(context))
		.or(UserRolesUpdated)
		.or(FactionCreated(parsers.factionReference(context)))
		.or(FactionUpdated(parsers.factionReference(context)))
		.or(FactionDeleted)
		.or(FactionMemberUpdated(
			context,
			parsers.factionReference,
			parsers.factionMember,
		))
		.or(AccessUpdate)
		.parse;
}
export type Event = ReturnType<ReturnType<typeof parser>>;
