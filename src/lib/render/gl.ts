import { Geometry, type Attribute, type OGLRenderingContext } from "ogl";

export const QUAD_VERTEX_SHADER = /* glsl */ `
// per vertex
attribute vec2 position;
attribute vec2 uv;
// per instance
attribute vec2 offset;
attribute vec2 size;
attribute float texture;

varying vec2 vUv;
varying float vTextureIndex;
varying vec2 vSize;

uniform mat3 uView;
uniform vec2 uAspect;
uniform vec2 uBoardSize;

void main() {
	vUv = uv;
	vTextureIndex = texture;
	vSize = size;
	gl_Position = vec4(uView * vec3((position + offset) * uAspect / size, 1.0), 1.0);
	gl_Position.y = -gl_Position.y;
}
`;

const QUAD_POSITION = [
	1, 1,
	0, 0,
	0, 1,
	0, 0,
	1, 1,
	1, 0,
];

// inv y because: yes, opengl 🙃
const QUAD_UV = [
	1, 0,
	0, 1,
	0, 0,
	0, 1,
	1, 0,
	1, 1,
];

export class InstancedQuad extends Geometry {
	declare public readonly attributes: {
		position: Attribute;
		uv: Attribute;
		offset: Attribute;
		texture: Attribute;
		size: Attribute;
	};

	constructor(gl: OGLRenderingContext) {
		super(gl, {
			position: { size: 2, data: new Float32Array(QUAD_POSITION) },
			uv: { size: 2, data: new Float32Array(QUAD_UV) },
			offset: { instanced: 1, size: 2, data: new Float32Array(16) },
			texture: { instanced: 1, size: 1, data: new Float32Array(8) },
			size: { instanced: 1, size: 2, data: new Float32Array(16) },
		});
	}
}