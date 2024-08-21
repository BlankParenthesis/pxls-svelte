import { z } from "zod";
import { UserReference } from "./user";
import { FactionReference } from "./faction";
import { FactionMemberReference } from "./factionmember";

export const UserUpdated = z.object({
	type: z.literal("user-updated"),
	user: UserReference,
});
export type UserUpdated = z.infer<typeof UserUpdated>;

export const UserRolesUpdated = z.object({
	type: z.literal("user-roles-updated"),
	user: z.string(),
});
export type UserRolesUpdated = z.infer<typeof UserRolesUpdated>;

export const FactionCreated = z.object({
	type: z.literal("faction-created"),
	faction: FactionReference,
});
export type FactionCreated = z.infer<typeof FactionCreated>;
export const FactionUpdated = z.object({
	type: z.literal("faction-updated"),
	faction: FactionReference,
});
export type FactionUpdated = z.infer<typeof FactionUpdated>;
export const FactionDeleted = z.object({
	type: z.literal("faction-deleted"),
	faction: z.string(),
});
export type FactionDeleted = z.infer<typeof FactionDeleted>;

export const FactionMemberUpdated = z.object({
	type: z.literal("faction-member-updated"),
	faction: FactionReference,
	member: FactionMemberReference,
});
export type FactionMemberUpdated = z.infer<typeof FactionMemberUpdated>;

export const Event = UserUpdated
	.or(UserRolesUpdated)
	.or(FactionCreated)
	.or(FactionUpdated)
	.or(FactionDeleted)
	.or(FactionMemberUpdated);
export type Event = z.infer<typeof Event>;