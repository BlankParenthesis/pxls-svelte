import { z } from "zod";

export const Permission = z.literal("info");
export type Permission = z.infer<typeof Permission>;