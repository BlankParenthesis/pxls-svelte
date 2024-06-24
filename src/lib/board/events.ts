import { z } from "zod";
import { ShapeParser } from "../render/shape";
import { Palette } from "./palette";

/* eslint-disable camelcase */
export const Change = z.object({
	position: z.number().int().min(0),
	values: z.array(z.number().int().min(0)),
}).or(z.object({
	position: z.number().int().min(0),
	length: z.number().int().min(1),
}));
export type Change = z.infer<typeof Change>;

export const BoardUpdate = z.object({
	type: z.literal("board-update"),
	info: z.object({
		name: z.string().optional(),
		shape: ShapeParser.optional(),
		palette: Palette.optional(),
		max_pixels_available: z.number().int().min(0).optional(),
	}).optional(),
	data: z.object({
		colors: z.array(Change).optional(),
		timestamps: z.array(Change).optional(),
		initial: z.array(Change).optional(),
		mask: z.array(Change).optional(),
	}).optional(),
});
export type BoardUpdate = z.infer<typeof BoardUpdate>;

export const PixelsAvailable = z.object({
	type: z.literal("pixels-available"),
	count: z.number().int().min(0),
	next: z.number().int().min(0).optional(),
});
export type PixelsAvailable = z.infer<typeof PixelsAvailable>;

export const Event = BoardUpdate
	.or(PixelsAvailable);
export type Event = z.infer<typeof Event>;
/* eslint-enable camelcase */