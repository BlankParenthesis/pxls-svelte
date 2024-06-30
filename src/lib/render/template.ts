import type { Texture } from "ogl";

export class Template {
	constructor(
		public readonly image: Texture,
		public x = 0,
		public y = 0,
	) {}
}
