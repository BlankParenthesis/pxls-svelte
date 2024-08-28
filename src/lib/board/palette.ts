import { z } from "zod";
import { type OGLRenderingContext, Texture } from "ogl";

/* eslint-disable camelcase */
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

	let nextColor = [0, 0, 0, 0];
	const array = new Array(maxEntry)
		.fill(undefined)
		.map((_, i) => {
			const color = palette.get(i);
			if(color === undefined) {
				return nextColor;
			} else {
				const r = (color.value >> 24) & 0xFF;
				const g = (color.value >> 16) & 0xFF;
				const b = (color.value >> 8) & 0xFF;
				const a = (color.value & 0xFF);
				// This sets the previous missing colors to this one.
				// We want to do this because when looking through the palette
				// linearly we want to find that the best distance is to a real
				// index and not just some false value here, so all values there
				// must be real colors.
				// We backfill rather than front-fill because the first index
				// may be empty but the last one will not because we stop there.
				// NOTE: this means that ties when searching for color distance
				// should favour the color with the highest index.
				nextColor[0] = r;
				nextColor[1] = g;
				nextColor[2] = b;
				nextColor[3] = a;
				// reset the variable for the next set of missing colors
				nextColor = [0, 0, 0, 0];
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
/* eslint-enable camelcase */