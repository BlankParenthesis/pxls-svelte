import { Geometry, type OGLRenderingContext } from "ogl-typescript";

export const QUAD_VERTEX_SHADER = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

uniform vec2 uTranslate;
uniform vec2 uScale;

void main() {
	vUv = uv;
	gl_Position = vec4(uScale * (position + uTranslate), 0.0, 1.0);
}
`;

const QUAD = [
	0, 1,
	0, 0,
	1, 1,
	1, 0,
	1, 1,
	0, 0,
];

export class Quad extends Geometry {
	constructor(gl: OGLRenderingContext) {
		const data = new Float32Array(QUAD);
		super(gl, {
			position: { size: 2, data },
			uv: { size: 2, data },
		});
	}
}