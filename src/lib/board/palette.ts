import { z } from "zod";
import { type OGLRenderingContext, Texture } from "ogl";

/* eslint camelcase: off */
export const Color = z.object({
	name: z.string(),
	value: z.number(),
	system_only: z.boolean().optional(),
});
export type Color = z.infer<typeof Color>;

export const Palette = z.record(
	z.string().transform(i => parseInt(i)).pipe(z.number()),
	Color,
).transform(o => new Map(Object.entries(o).map(([k, v]) => [parseInt(k), v])));
export type Palette = z.infer<typeof Palette>;

export function toTexture(
	gl: OGLRenderingContext,
	palette: Palette,
): Texture {
	const maxEntry = [...palette.keys()]
		.reduce((length, i) => Math.max(i + 1, length), 0);

	const array = new Array(maxEntry)
		.fill(undefined)
		.map((_, i) => {
			const color = palette.get(i);
			if(color === undefined) {
				return [0, 0, 0, 0];
			} else {
				const r = (color.value >> 24) & 0xFF;
				const g = (color.value >> 16) & 0xFF;
				const b = (color.value >> 8) & 0xFF;
				const a = (color.value & 0xFF);
				return [r, g, b, a];
			}
		})
		.flat();

	return new Texture(gl, {
		image: Uint8Array.from(array),
		width: maxEntry,
		height: 1,
		magFilter: gl.NEAREST,
		minFilter: gl.NEAREST,
	});
}