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

export const CANVAS_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

#define HEATMAP_COLOR vec3(0.8, 0.2, 0.3)

varying vec2 vUv;

uniform sampler2D tPalette;
uniform float uPaletteSize;
uniform sampler2D tIndices;
uniform sampler2D tTimestamps;
uniform vec2 uTimestampRange;
// FIXME: this is a bad uniform name since it's actually the inverse of what it claims
uniform float uHeatmapDim;

void main() {
	vec4 canvasdata = texture2D(tIndices, vUv);
	float index = floor(canvasdata.r * 255.0 + 0.5);
	vec4 timestampBytes = texture2D(tTimestamps, vUv);
	vec4 color = texture2D(tPalette, vec2(index / uPaletteSize, 0.0));

	// Our timestamp is packed into a RGBA color.
	// It's an unsigned 32-bit integer in little endian form.
	// To unpack it, we have to multiply each value by 256 and shift it left
	// based on that byte's position. WebGL can't do bitshifting but it turns
	// out that's the same thing as multiplying by 2 to the power of your
	// bitshift. We can combine our 255 normalization multiplication and our
	// bitshift into a single multiplication for each component.
	float timestamp =
		timestampBytes.r * 255.0 + // 255 * 2^0
		timestampBytes.g * 65280.0 + // 255 * 2^8
		timestampBytes.b * 16711680.0 + // 255 * 2^16
		timestampBytes.a * 4278190080.0; // 255 * 2^24

	float heatmapIntensity = (timestamp - uTimestampRange.x) / (uTimestampRange.y - uTimestampRange.x);
	
	if (heatmapIntensity > 1.0 || heatmapIntensity < 0.0) {
		heatmapIntensity = 0.0;
	}
	gl_FragColor = vec4(mix(color.rgb * uHeatmapDim, HEATMAP_COLOR, heatmapIntensity), color.a);
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