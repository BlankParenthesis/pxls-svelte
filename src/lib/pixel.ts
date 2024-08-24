import { z } from "zod";
import { page } from "./page";
import type { Readable } from "svelte/store";
import { UserReference, type User } from "./user";

const RawPixel = z.object({
	"position": z.number().int().min(0),
	"color": z.number().int().min(0),
	"modified": z.number().int().min(0),
	"user": UserReference,
});
export type RawPixel = z.infer<typeof RawPixel>;

export const PixelsPage = page(RawPixel);

export class Pixel  {
	constructor(
		readonly position: number,
		readonly color: number,
		readonly modified: Date,
		readonly user?: Readable<Promise<User>>,
	) {}

	static parse(input: unknown): RawPixel {
		return RawPixel.parse(input);
	}
}