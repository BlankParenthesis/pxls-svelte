import { type OGLRenderingContext, Program, Vec2, Mat3 } from "ogl";
import { QUAD_VERTEX_SHADER } from "../gl";
import type { Instanceable } from "../../util";

export type DebugUniforms = {
	uView: { value: Mat3 };
	uAspect: { value: Vec2 };
	uOutline: { value: number };
	uOutlineStripe: { value: number };
};

const DEBUG_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying float vTextureIndex;

#define OUTLINE_PRIMARY vec3(0.0)
#define OUTLINE_SECONDARY vec3(0.8, 0.7, 0.3)

uniform float uOutline;
uniform float uOutlineStripe;

void main() {
	float thickness = uOutline / 2.0;
	bool outline = min(vUv.x, vUv.y) < thickness || max(vUv.x, vUv.y) > 1.0 - thickness;
	bool outlineSelect = mod(vUv.x + vUv.y, uOutlineStripe * 2.0) < uOutlineStripe;
	vec3 outlineColor = mix(OUTLINE_PRIMARY, OUTLINE_SECONDARY, outlineSelect ? 1.0 : 0.0);
	vec3 finalColor = mix(outlineColor, vec3(vTextureIndex / 3.0), outline ? 0.0 : 1.0);
	gl_FragColor = vec4(finalColor, 1.0);
}
`;


export class DebugProgram extends Program implements Instanceable {
	declare public readonly uniforms: DebugUniforms;
	public readonly maxParallelism = 4;

	constructor(gl: OGLRenderingContext) {
		super(gl, {
			vertex: QUAD_VERTEX_SHADER,
			fragment: DEBUG_FRAGMENT_SHADER,
			uniforms: {
				uView: { value: new Mat3().identity().translate(new Vec2(-0.5, -0.5)) },
				uAspect: { value: new Vec2(0.0, 0.0) },
				uOutline: { value: 0 },
				uOutlineStripe: { value: 8 },
			},
		});
	}
}