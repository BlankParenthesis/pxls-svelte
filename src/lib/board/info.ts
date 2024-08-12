import { z } from "zod";

import { Palette } from "./palette";
import { ShapeParser } from "../render/shape";
import { reference } from "../reference";
import { page } from "../page";

/* eslint-disable camelcase */
export const BoardInfo = z.object({
	name: z.string(),
	created_at: z.number().int().min(0),
	shape: ShapeParser,
	max_pixels_available: z.number().int().min(0),
	palette: Palette,
});
export type BoardInfo = z.infer<typeof BoardInfo>;
/* eslint-enable camelcase */
export const BoardReference = reference(BoardInfo);
export const BoardsPage = page(BoardReference);