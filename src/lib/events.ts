import { z } from "zod";
import { UserReference } from "./user";

export const UserUpdated = z.object({
	type: z.literal("user-updated"),
	user: UserReference,
});
export type UserUpdated = z.infer<typeof UserUpdated>;

export const UserRolesUpdated = z.object({
	type: z.literal("user-roles-updated"),
	user: z.string(),
});
export type UserRolesUpdated = z.infer<typeof UserUpdated>;

export const Event = UserUpdated
	.or(UserRolesUpdated);
export type Event = z.infer<typeof Event>;