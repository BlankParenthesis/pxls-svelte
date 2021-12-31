import { OGLRenderingContext, Texture } from "ogl-typescript";

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
				value = hex.split("").map(c => parseInt(c, 16));
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
}

export type Palette = Map<number, Color>;

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