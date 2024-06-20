import { z, type ZodTypeAny } from "zod";
import { BoardInfo } from "./board/info";

/**
 * creates a parser for a reference of an object
 * @param view the parser for the object
 * @returns the parser for a reference of the view
 */
function reference<T extends ZodTypeAny>(view: T) {
	return z.object({
		uri: z.string(),
		view: view.optional(),
	});
}

export const BoardReference = reference(BoardInfo);
