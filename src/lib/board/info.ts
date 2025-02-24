import { z } from "zod";

import { Palette } from "./palette";
import { Shape, ShapeParser } from "../render/shape";
import type { Requester } from "../requester";
import type { Parser } from "../util";
import type { Updatable } from "../cache";

export class BoardInfo implements Updatable {
	constructor(
		public name: string,
		public readonly createdAt: Date,
		public shape: Shape,
		public maxPixelsAvailable: number,
		public palette: Palette,
	) {}

	/* eslint-disable camelcase */
	static parser(parseTime: (time: number) => Date): Parser<BoardInfo> {
		return (http: Requester) => z.object({
			name: z.string(),
			created_at: z.number().int().min(0).transform(parseTime),
			shape: ShapeParser,
			max_pixels_available: z.number().int().min(0),
			palette: Palette,
		}).transform(({ name, created_at, shape, max_pixels_available, palette }) => {
			return new BoardInfo(name, created_at, shape, max_pixels_available, palette);
		});
	}
	/* eslint-enable camelcase */

	update(newValue: this): this {
		return newValue;
	}
}
