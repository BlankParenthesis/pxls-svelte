import { z, type ZodTypeAny } from "zod";
import { BoardInfo } from "./board/board";

/**
 * Wait until the page is about to render.
 * NOTE: Awaiting after this point will likely miss the frame.
 */
export function nextFrame(): Promise<DOMHighResTimeStamp> {
	return new Promise(resolve => requestAnimationFrame(resolve));
}

export function randomString(length: number = 20): string {
	const choices = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
	return Array(length).fill(null).map(() => {
		const index = Math.floor(Math.random() * choices.length);;
		return choices[index];
	}).join("");
}

/**
 * helper function for handling url joining with special handling for trailing slashes.
 * @param base the base url
 * @param path the subpath to append
 * @returns the path appended to the base
 */
export function resolveURL(base: URL, path: string): URL {
	if (base.pathname.endsWith("/")) {
		return new URL(path, base);
	} else {
		return new URL(path, base.origin + base.pathname + "/");
	}
}

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
