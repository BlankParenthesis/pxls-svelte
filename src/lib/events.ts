import { z } from "zod";
import type { Reference } from "./reference";
import type { User } from "./user";
import type { Faction } from "./faction";
import type { FactionMember } from "./factionmember";
import type { Requester } from "./requester";
import type { Parser } from "./util";

const UserUpdated = (sub: (data: unknown) => Reference<User>) => z.object({
	type: z.literal("user-updated"),
	user: z.unknown().transform(sub),
});

const UserRolesUpdated = z.object({
	type: z.literal("user-roles-updated"),
	user: z.string(),
});

const FactionCreated = (sub: (data: unknown) => Reference<Faction>) => z.object({
	type: z.literal("faction-created"),
	faction: z.unknown().transform(sub),
});

const FactionUpdated = (sub: (data: unknown) => Reference<Faction>) => z.object({
	type: z.literal("faction-updated"),
	faction: z.unknown().transform(sub),
});

const FactionDeleted = z.object({
	type: z.literal("faction-deleted"),
	faction: z.string(),
});

const FactionMemberUpdated = (
	factionParser: (data: unknown) => Reference<Faction>,
	memberParser: (data: unknown) => Reference<FactionMember>,
) => z.object({
	type: z.literal("faction-member-updated"),
	faction: z.unknown().transform(factionParser),
	member: z.unknown().transform(memberParser),
});

export function parser(context: Requester, parsers: {
	userReference: Parser<Reference<User>>,
	factionReference: Parser<Reference<Faction>>,
	factionMemberReference: Parser<Reference<FactionMember>>,
}) {
	return UserUpdated(parsers.userReference(context))
		.or(UserRolesUpdated)
		.or(FactionCreated(parsers.factionReference(context)))
		.or(FactionUpdated(parsers.factionReference(context)))
		.or(FactionDeleted)
		.or(FactionMemberUpdated(
			parsers.factionReference(context),
			parsers.factionMemberReference(context),
		))
		.parse;
}