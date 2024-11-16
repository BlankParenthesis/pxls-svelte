import { type OGLRenderingContext, Program, Texture, Vec2, Mat3 } from "ogl";
import { QUAD_VERTEX_SHADER } from "../gl";
import type { Instanceable } from "../../util";

export type CanvasUniforms = {
	uView: { value: Mat3 };
	uAspect: { value: Vec2 };
	uSize: { value: Vec2 };
	tPalette: { value: Texture };
	uPaletteSize: { value: number };
	tIndices: { value: Array<Texture> };
	tTimestamps: { value: Array<Texture> };
	uTimestampRange: { value: Vec2 };
	uHeatmapDim: { value: number };
};

const CANVAS_FRAGMENT_SHADER = (reduced: boolean) => /* glsl */ `
precision highp float;

#define HEATMAP_COLOR vec4(0.8, 0.2, 0.3, 1.0)
#define TEXTURE_UNITS ${reduced ? 2 : 4}

varying vec2 vUv;
varying float vTextureIndex;

uniform sampler2D tPalette;
uniform float uPaletteSize;
uniform sampler2D tIndices[TEXTURE_UNITS];
uniform sampler2D tTimestamps[TEXTURE_UNITS];
uniform vec2 uTimestampRange;
// FIXME: this is a bad uniform name since it's actually the inverse of what it claims
uniform float uHeatmapDim;
uniform vec2 uSize;

void main() {
	int bind = int(vTextureIndex);
	vec4 canvasData;
	vec4 timestampBytes;
	for (int i = 0; i < TEXTURE_UNITS; i++) {
		if (i == bind) {
			canvasData = texture2D(tIndices[i], vUv);
			timestampBytes = texture2D(tTimestamps[i], vUv);
		}
	}

	float index = floor(canvasData.r * 255.0 + 0.5);
	vec4 color = texture2D(tPalette, vec2((index + 0.5) / uPaletteSize, 0.5));

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

	float heatmapIntensity;
	if (uTimestampRange.y == uTimestampRange.x) {
		heatmapIntensity = 0.0;
	} else {
		heatmapIntensity = (timestamp - uTimestampRange.x) / (uTimestampRange.y - uTimestampRange.x);
	}
	
	if (heatmapIntensity > 1.0 || heatmapIntensity < 0.0) {
		heatmapIntensity = 0.0;
	}

	vec4 dimmedColor = vec4(color.rgb * uHeatmapDim, color.a); 
	gl_FragColor = mix(dimmedColor, HEATMAP_COLOR, heatmapIntensity);
}
`;

export class CanvasProgram extends Program implements Instanceable {
	declare public readonly uniforms: CanvasUniforms;
	public readonly maxParallelism: number;


	constructor(gl: OGLRenderingContext) {
		// We want to render 4 tiles at once, each has 2 textures:
		// - the color indices
		// - the heatmap
		// We also store the palette as a texture.
		// This is 4 * 2 + 1 = 9 texture units required.
		// The minimum guaranteed to be supported is 8, so we need to check if
		// we need to split it in half and only render two tiles at once:
		const reduced = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 9;
		const maxSectors = reduced ? 2 : 4;

		super(gl, {
			vertex: QUAD_VERTEX_SHADER,
			fragment: CANVAS_FRAGMENT_SHADER(reduced),
			uniforms: {
				uView: { value: new Mat3().identity().translate(new Vec2(-0.5, -0.5)) },
				uAspect: { value: new Vec2(0.0, 0.0) },
				uSize: { value: new Vec2(0.0, 0.0) },
				tPalette: { value: new Texture(gl) },
				uPaletteSize: { value: 1 },
				tIndices: { value: Array(maxSectors).fill(new Texture(gl)) },
				tTimestamps: { value: Array(maxSectors).fill(new Texture(gl)) },
				uTimestampRange: { value: new Vec2(0, 3000) },
				uHeatmapDim: { value: 1 },
			},
		});

		this.maxParallelism = maxSectors;
	}
}