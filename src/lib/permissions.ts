import { z } from "zod";

export const Permission = z.string();
export type Permission = z.infer<typeof Permission>;

export const Permissions = z.set(Permission);
export type Permissions = z.infer<typeof Permissions>;