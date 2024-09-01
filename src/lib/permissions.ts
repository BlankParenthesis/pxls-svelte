import { z } from "zod";

export const Permission = z.string();
export type Permission = z.infer<typeof Permission>;

export const Permissions = z.array(Permission).transform(a => new Set(a));
export type Permissions = z.infer<typeof Permissions>;