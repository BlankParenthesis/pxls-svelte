import { z, type ZodTypeAny } from "zod";
import { BoardReference } from "./reference";

/**
 * creates a parser for a page of objects
 * @param view the parser for the object
 * @returns the parser for a page
 */
function page<T extends ZodTypeAny>(view: T) {
	return z.object({
		items: z.array(view),
		next: z.string().nullable().optional(),
		previous: z.string().nullable().optional(),
	});
}

export const BoardsPage = page(BoardReference);
