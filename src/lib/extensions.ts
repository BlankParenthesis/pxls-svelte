import { z } from "zod";

export const Extension = z.string();
export type Extension = z.infer<typeof Extension>;