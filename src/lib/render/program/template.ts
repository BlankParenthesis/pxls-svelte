import { type OGLRenderingContext, Program, Texture, Vec2, Mat3 } from "ogl";
import { QUAD_VERTEX_SHADER } from "../gl";
import type { Instanceable } from "../../util";

type TemplateUniforms = {
	uView: { value: Mat3 };
	uAspect: { value: Vec2 };
	tPalette: { value: Texture };
	uPaletteSize: { value: number };
	tTemplate: { value: Array<Texture> };
	tStyle: { value: Texture };
	uHeatmapDim: { value: number };
	uBoardSize: { value: Vec2 };
};

const TEMPLATE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

#define PALETTE_STYLE_WIDTH 16.0

varying vec2 vUv;
varying float vTextureIndex;
varying vec2 vSize;

uniform sampler2D tPalette;
uniform float uPaletteSize;
uniform sampler2D tTemplate[7];
uniform sampler2D tStyle;
uniform float uHeatmapDim;
uniform vec2 uBoardSize;

void main() {
	int bind = int(vTextureIndex);
	vec4 templateData;
	for (int i = 0; i < 7; i++) {
		if (i == bind) {
			templateData = texture2D(tTemplate[i], vUv);
		}
	}

	float index = floor(templateData.r * 255.0 + 0.5);
	vec2 indexTranslate = vec2(
		mod(index, PALETTE_STYLE_WIDTH),
		// y is upside down in gl
		PALETTE_STYLE_WIDTH - floor(index / PALETTE_STYLE_WIDTH + 1.0)
	) / PALETTE_STYLE_WIDTH;

	gl_FragColor = texture2D(tPalette, vec2((index + 0.5) / uPaletteSize, 0.5));
	gl_FragColor.rgb *= uHeatmapDim;

	vec2 normalizedUv = mod(vUv * uBoardSize / vSize, 1.0) / PALETTE_STYLE_WIDTH;
	vec2 styleUv = normalizedUv + indexTranslate;
	gl_FragColor.a = templateData.a;
	gl_FragColor.a *= texture2D(tStyle, styleUv).a;
}
`;

export class TemplateProgram extends Program implements Instanceable {
	public readonly uniforms: TemplateUniforms;
	public readonly maxParallelism: number = 7;

	constructor(gl: OGLRenderingContext, styleImage: HTMLImageElement) {
		// NOTE: this would be more efficient as a single channel texture,
		// webgl doesn't support conversion and it's hard to do in js.
		const templateStyle = new Texture(gl, {
			width: 32,
			height: 32,
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});

		styleImage.onload = () => {
			// NOTE: we need to clone the image otherwise ogl will assume it
			// hasn't changed.
			templateStyle.image = styleImage.cloneNode() as HTMLImageElement;
		};

		super(gl, {
			vertex: QUAD_VERTEX_SHADER,
			fragment: TEMPLATE_FRAGMENT_SHADER,
			transparent: true,
		});

		this.setBlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.DST_ALPHA);

		this.uniforms = {
			uView: { value: new Mat3().identity() },
			uAspect: { value: new Vec2(0, 0) },
			tPalette: { value: new Texture(gl) },
			uPaletteSize: { value: 1 },
			tTemplate: { value: Array(7).fill(new Texture(gl)) },
			tStyle: { value: templateStyle },
			uHeatmapDim: { value: 0 },
			uBoardSize: { value: new Vec2(1, 1) },
		};
	}
}
