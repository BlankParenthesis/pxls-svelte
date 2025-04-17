import { z, type ZodType, type ZodTypeDef } from "zod";
import type { Reference } from "./reference";
import type { User } from "./user";
import type { Faction } from "./faction";
import type { FactionMember } from "./factionmember";
import type { Requester } from "./requester";
import type { Parser } from "./util";

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

const FactionMemberUpdated = (
	factionParser: ZodType<Reference<Faction>, ZodTypeDef, unknown>,
	memberParser: ZodType<Reference<FactionMember>, ZodTypeDef, unknown>,
) => z.object({
	type: z.literal("faction-member-updated"),
	faction: z.unknown().pipe(factionParser),
	member: z.unknown().pipe(memberParser),
});

export function parser(context: Requester, parsers: {
	userReference: Parser<Reference<User>>;
	factionReference: Parser<Reference<Faction>>;
	factionMemberReference: Parser<Reference<FactionMember>>;
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
export type Event = ReturnType<ReturnType<typeof parser>>;
