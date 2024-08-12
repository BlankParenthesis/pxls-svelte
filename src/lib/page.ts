import { z, type ZodTypeAny } from "zod";

/**
 * creates a parser for a page of objects
 * @param view the parser for the object
 * @returns the parser for a page
 */
export function page<T extends ZodTypeAny>(view: T) {
	return z.object({
		items: z.array(view),
		next: z.string().nullable().optional(),
		previous: z.string().nullable().optional(),
	});
}

