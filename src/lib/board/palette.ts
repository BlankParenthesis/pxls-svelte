import { z } from "zod";
import { type OGLRenderingContext, Texture } from "ogl-typescript";

/* eslint camelcase: off */
export const color = z.object({
	name: z.string(),
	value: z.number(),
	system_only: z.boolean().optional(),
}).transform(c => Color.fromNumber(c.name, c.value));

export class Color {
	constructor(
		public name: string,
		public value: [number, number, number, number],
	) {}

	static fromHex(name: string, hex: string): Color {
		if (hex.startsWith("#")) {
			hex = hex.substring(1);
		}

		let value: number[];

		switch (hex.length) {
			case 3:
				hex += "f";
				// falls through (3 is just a special case of 4)
			case 4:
				value = hex.split("").map(c => 0x11 * parseInt(c, 16));
				break;
			case 6:
				hex += "ff";
				// falls through (6 is just a special case of 8)
			case 8:
				value = (hex.match(/.{2}/g) as string[]).map(c => parseInt(c, 16));
				break;
			default:
				throw new Error("Invalid color length");
		}

		// TODO: validate value

		return new Color(name, value as [number, number, number, number]);
	}

	static fromNumber(name: string, value: number): Color {
		const r = (value >> 24) & 0xFF;
		const g = (value >> 16) & 0xFF;
		const b = (value >> 8) & 0xFF;
		const a = value & 0xFF;
		return new Color(name, [r, g, b, a]);
	}
}

export const Palette = z.record(
	z.string().transform(i => parseInt(i)).pipe(z.number()),
	color,
).transform(o => new Map(Object.entries(o).map(([k, v]) => [parseInt(k), v])));

export type Palette = z.infer<typeof Palette>;

function toArray(palette: Palette): Array<[number, number, number, number]> {
	const maxEntry = [...palette.keys()]
		.reduce((length, i) => Math.max(i + 1, length), 0);
	return new Array(maxEntry)
		.fill([0, 0, 0, 0])
		.map((transparent: [0, 0, 0, 0], i) => {
			const color = palette.get(i);
			if(color === undefined) {
				return transparent;
			} else {
				return color.value;
			}
		});
}

export function toTexture(
	gl: OGLRenderingContext,
	palette: Palette,
): Texture {
	const arrayPalette = toArray(palette);
	return new Texture(gl, {
		image: new Uint8Array(arrayPalette.flat()),
		width: arrayPalette.length,
		height: 1,
		magFilter: gl.NEAREST,
		minFilter: gl.NEAREST,
	});
}