import { z } from "zod";

import { Palette } from "./palette";
import { Shape } from "../render/shape";

/* eslint camelcase: off */
export const BoardInfo = z.object({
	name: z.string(),
	created_at: z.number().int().min(0),
	shape: z.array(z.array(z.number()).length(2)).min(1)
		.transform(s => {
			if (s.length === 0) {
				throw new Error("Degenerate board shape");
			} else if (s.length === 1) {
				return new Shape([[1,1], s[0] as [number, number]]);
			} else {
				return new Shape(s as Array<[number, number]>);
			}
		}),
	max_pixels_available: z.number().int().min(0),
	palette: Palette,
});
export type BoardInfo = z.infer<typeof BoardInfo>;