import { z } from "zod";

export const Extension = z.literal("authentication");
export type Extension = z.infer<typeof Extension>;