import { OGLRenderingContext, Program, Texture, Vec2 } from "ogl-typescript";
import { QUAD_VERTEX_SHADER } from "./gl";

const TEMPLATE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

#define PALETTE_STYLE_WIDTH 16.0

varying vec2 vUv;

uniform sampler2D tPalette;
uniform float uPaletteSize;
uniform vec2 uTemplateSize;
uniform sampler2D tTemplate;
uniform sampler2D tStyle;
uniform float uHeatmapDim;

void main() {
	vec4 templatedata = texture2D(tTemplate, vUv);
	float index = floor(templatedata.r * 255.0 + 0.5);
	vec2 indexTranslate = vec2(
		mod(index, PALETTE_STYLE_WIDTH),
		// flip y position but not inter-pixel
		floor(index / PALETTE_STYLE_WIDTH - 1.0) + PALETTE_STYLE_WIDTH
	) / PALETTE_STYLE_WIDTH;
	gl_FragColor = texture2D(tPalette, vec2(index / uPaletteSize, 0.0));
	gl_FragColor.rgb *= uHeatmapDim;
	vec2 normalizedUv = mod(vUv * uTemplateSize, 1.0) / PALETTE_STYLE_WIDTH;
	vec2 styleUv = normalizedUv + indexTranslate;
	gl_FragColor.a *= texture2D(tStyle, styleUv).a;
}
`;

type TemplateUniforms = {
	uTranslate: { value: Vec2 };
	uScale: { value: Vec2 };
	tPalette: { value: Texture };
	uPaletteSize: { value: number };
	tTemplate: { value: Texture };
	uTemplateSize: { value: Vec2 };
	tStyle: { value: Texture }
	uHeatmapDim: { value: number };
};

export class Template {
	x = 0;
	y = 0;

	constructor(
		readonly image: Texture,
	) {}
}

export type TemplateProgram = Omit<Program, "uniforms"> & { uniforms: TemplateUniforms };
export function newTemplateProgram(gl: OGLRenderingContext): TemplateProgram {
	// NOTE: this would be more efficient as a single channel texture,
	// webgl doesn't support conversion and it's hard to do in js.
	const templateStyle = new Texture(gl, {
		width: 32,
		height: 32,
		magFilter: gl.NEAREST,
	});
	const styleImage = new Image();
	styleImage.onload = () => {
		templateStyle.image = styleImage;
	};
	styleImage.src = "./large_template_style.png";

	return new Program(gl, {
		vertex: QUAD_VERTEX_SHADER,
		fragment: TEMPLATE_FRAGMENT_SHADER,
		uniforms: {
			uTranslate: { value: new Vec2() },
			uScale: { value: new Vec2(1, 1) },
			tPalette: { value: new Texture(gl) },
			uPaletteSize: { value: 1 },
			tTemplate: { value: new Texture(gl) },
			uTemplateSize: { value: new Vec2(1, 1) },
			tStyle: { value: templateStyle },
			uHeatmapDim: { value: 0 },
		} as TemplateUniforms,
		transparent: true,
	}) as TemplateProgram;
}
