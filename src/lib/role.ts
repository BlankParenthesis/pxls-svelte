import { z } from "zod";
import { reference } from "./reference";
import { page } from "./page";

export const Role = z.object({
	"name": z.string(),
	"icon": z.string().optional(),
});
export type Role = z.infer<typeof Role>;

export const RoleReference = reference(Role);
export type RoleReference = z.infer<typeof RoleReference>;
export const RolesPage = page(RoleReference);
export type RolesPage = z.infer<typeof RoleReference>;