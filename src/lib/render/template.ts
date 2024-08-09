import { Texture, type OGLRenderingContext } from "ogl";

export class Template {
	constructor(
		public readonly image: Texture,
		public x = 0,
		public y = 0,
	) {}

	static texture(
		gl: OGLRenderingContext, 
		data: Uint8Array, 
		width: number, 
		height: number,
	): Texture {
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
		const texture = new Texture(gl, {
			image: data,
			width,
			height,
			format: gl.LUMINANCE,
			internalFormat: gl.LUMINANCE,
			minFilter: gl.NEAREST,
			magFilter: gl.NEAREST,
		});
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		return texture;
	}
}
