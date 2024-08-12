import { z, type ZodTypeAny } from "zod";

/**
 * creates a parser for a reference of an object
 * @param view the parser for the object
 * @returns the parser for a reference of the view
 */
export function reference<T extends ZodTypeAny>(view: T) {
	return z.object({
		uri: z.string(),
		view: view.optional(),
	});
}

