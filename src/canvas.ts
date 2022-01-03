import { Texture, Vec2, Renderer, Program, Mesh, OGLRenderingContext } from "ogl-typescript";
import type { Board } from "./backend/backend";
import { QUAD_VERTEX_SHADER, Quad } from "./gl";
import { toTexture } from "./palette";
import type { Shape } from "./shape";
import { newTemplateProgram, Template, TemplateProgram } from "./template";
import { CanvasTextures } from "./canvastextures";
import { nextFrame } from "./util";

const CANVAS_FRAGMENT_SHADER = /* glsl */ `
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

function fromTranslateToTile(coord: number, scaleModifier: number) {
	const unrounded = coord * scaleModifier + 0.5;
	const rounded = Math.ceil(unrounded);
	// Modulo starts working on the integer mark. (1%1 == 0, not 1)
	// Ceil (and floor) stop working on the integer mark. (ceil(1) == 1, not 2)
	// The below corrects for this difference.
	// NOTE: This is basically a hack regardless and I've still seen issues
	// related to this happen. Perhaps a better solution would be to use the 
	// same rounding for both the display position and the tile coordinates.
	if (unrounded === rounded) {
		return rounded + 1;
	} else {
		return rounded;
	}
}

export type RenderSettings = {
	detailLevel: number,
	autoDetail: boolean,
	templates: Template[],
	timestampRange: Vec2,
	heatmapDim: number,
};
export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
	detailLevel: 1,
	autoDetail: true,
	templates: [],
	timestampRange: new Vec2(0, 3000),
	heatmapDim: 0,
};

type ChunkMetadata = {
	gl: OGLRenderingContext;
	arrangementWidth: number;
	arrangementHeight: number;
	pixelsWidth: number;
	pixelsHeight: number;
};

type CanvasUniforms = {
	uTranslate: { value: Vec2 };
	uScale: { value: Vec2 };
	uOutline: { value: number };
	uOutlineStripe: { value: number };
	tPalette: { value: Texture };
	uPaletteSize: { value: number };
	tIndices: { value: Texture };
	tTimestamps: { value: Texture };
	uTimestampRange: { value: Vec2 };
	uHeatmapDim: { value: number };
};
type CanvasProgram = Omit<Program, "uniforms"> & { uniforms: CanvasUniforms };

interface RenderInfo {
	shape: Shape,
	size: [number, number];
	scale: Vec2;
	paletteTexture: Texture;
	timestamp: DOMHighResTimeStamp;
	detailLevel: number;
}

export class Canvas {
	private palette: Promise<Texture>;
	private readonly renderer: Renderer;
	private readonly program: CanvasProgram;
	private readonly templateProgram: TemplateProgram;
	private mesh: Mesh;
	private templateMesh: Mesh;
	private textures: CanvasTextures;

	zoomScale = new Vec2(1, 1);
	screenScale = new Vec2(1, 1);
	ratioScale = new Vec2(1, 1);
	translate = new Vec2(-0.5, -0.5);

	get gl() {
		return this.renderer.gl;
	}

	async size(): Promise<[number, number]> {
		return (await this.board.info()).shape.size();
	}

	constructor(
		private board: Board,
		private shape: Shape,
		canvas?: HTMLCanvasElement,
	) {
		this.renderer = new Renderer({
			canvas,
			autoClear: false,
			depth: false,
		});
		const gl = this.gl;

		this.palette = (async () => {
			const { palette } = await board.info();
			return toTexture(gl, palette);
		})();

		gl.clearColor(0, 0, 0, 1);

		const textures = this.textures = new CanvasTextures(gl, board, shape);
		this.board.on("board_update", (update) => {
			if (update.data !== undefined) {
				if (update.data.colors !== undefined) {
					update.data.colors.forEach(textures.updateColors.bind(textures));
				}
				if (update.data.timestamps !== undefined) {
					update.data.timestamps.forEach(textures.updateTimestamps.bind(textures));
				}
				if (update.data.mask !== undefined) {
					update.data.mask.forEach(textures.updateMask.bind(textures));
				}
				if (update.data.initial !== undefined) {
					update.data.initial.forEach(textures.updateInitial.bind(textures));
				}
				this.render().catch(console.error);
			}
		});

		const uniforms: CanvasUniforms = {
			uTranslate: { value: new Vec2(this.translate[0], this.translate[1]) },
			uScale: { value: new Vec2(this.scale[0], this.scale[1]) },
			uOutline: { value: 0 },
			uOutlineStripe: { value: 8 },
			tPalette: { value: new Texture(gl) },
			uPaletteSize: { value: 1 },
			tIndices: { value: new Texture(gl) },
			tTimestamps: { value: new Texture(gl) },
			uTimestampRange: { value: DEFAULT_RENDER_SETTINGS.timestampRange },
			uHeatmapDim: { value: 1 - DEFAULT_RENDER_SETTINGS.heatmapDim },
		};

		this.program = new Program(gl, {
			vertex: QUAD_VERTEX_SHADER,
			fragment: CANVAS_FRAGMENT_SHADER,
			uniforms,
		}) as CanvasProgram;

		this.templateProgram = newTemplateProgram(gl);

		const geometry = new Quad(gl);
		this.mesh = new Mesh(this.gl, { geometry, program: this.program });
		this.templateMesh = new Mesh(this.gl, { geometry, program: this.templateProgram });
	}

	get scale() {
		return new Vec2(
			this.zoomScale[0] * this.screenScale[0] * this.ratioScale[0],
			this.zoomScale[1] * this.screenScale[1] * this.ratioScale[1],
		);
	}

	async setSize(newWidth: number, newHeight: number) {
		if (this.gl.canvas.width !== newWidth || this.gl.canvas.height !== newHeight) {
			this.renderer.setSize(newWidth, newHeight);
			
			if (newWidth > newHeight) {
				this.screenScale[0] = 1;
				this.screenScale[1] = newWidth / newHeight;
			} else {
				this.screenScale[0] = newHeight / newWidth;
				this.screenScale[1] = 1;
			}
		}

		const [width, height] = await this.size();

		if(width > height) {
			this.ratioScale[0] = width / height;
			this.ratioScale[1] = 1;
		} else {
			this.ratioScale[0] = 1;
			this.ratioScale[1] = height / width;
		}
	}

	private detailLevel(shape: Shape) {
		// Length is 1 more than max index and the last index is 1-to-1.
		// So minus 2.
		const maxDetailLevel = shape.depth - 2;
		let detailLevel = 0;
		let [x, y] = this.scale;
		x /= 2;
		y /= 2;
		let dimensions = shape.slice(0, detailLevel + 2).size();
		while (detailLevel < maxDetailLevel && x > dimensions[0] && y > dimensions[1]) {
			detailLevel += 1;
			dimensions = shape.slice(0, detailLevel + 2).size();
		}
		return Math.max(0, Math.min(detailLevel, maxDetailLevel));
	}

	private async prepareToRender(): Promise<RenderInfo> {
		const { shape } = (await this.board.info());
		const detailLevel = this.detailLevel(shape);
		const paletteTexture = await this.palette;
		const size = shape.size();
		const scale = this.scale;

		// NOTE: must be last
		const timestamp = await nextFrame();

		return {
			shape,
			size,
			scale,
			timestamp,
			paletteTexture,
			detailLevel,
		};
	}

	private renderCanvas(
		{ paletteTexture, detailLevel, shape }: RenderInfo,
	) {
		this.program.uniforms.tPalette.value = paletteTexture;
		this.program.uniforms.uPaletteSize.value = paletteTexture.width - 1;

		// NOTE: there is a potential fast-path here when rendering detail level
		// 0 (the full canvas). In that case, we only need to render one quad
		// and scale/translate becomes simple, but it adds a condition and
		// increases the indentation level, so I have elected to not use it for
		// now.

		const scaleModifier = shape.slice(0, detailLevel + 1).size();
		const translate = new Vec2(...[this.translate[0], this.translate[1]].map((translate, i) => {
			const scaledTranslate = translate * scaleModifier[i];
			
			const offset = scaledTranslate >= -0.5 ? 1.5 : 0.5;

			return (scaledTranslate + offset) % 1 - offset;
		}));
		this.program.uniforms.uScale.value = new Vec2(...[this.scale[0], this.scale[1]].map((scale, i) => {
			return scale / scaleModifier[i];
		}));

		const x = -fromTranslateToTile(this.translate[0], scaleModifier[0]);
		const y = scaleModifier[1] + fromTranslateToTile(this.translate[1], scaleModifier[1]) - 1;

		for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
			const ox = x + dx;
			const oy = y - dy;
			const textures = this.textures.get(detailLevel, ox, oy);
			if (textures !== null) {
				this.program.uniforms.uTranslate.value = new Vec2(translate[0] + dx, translate[1] + dy);
				this.program.uniforms.tIndices.value = textures.colors();
				this.program.uniforms.tTimestamps.value = textures.timestamps();
				
				this.renderer.render({
					scene: this.mesh,
				});
			}
		}
		
		this.textures.prune();
	}

	private renderTemplates(
		{ size, paletteTexture }: RenderInfo,
		templates: Template[],
	) {
		const [width, height] = size;
		this.templateProgram.uniforms.tPalette.value = paletteTexture;
		this.templateProgram.uniforms.uPaletteSize.value = paletteTexture.width;

		for (const template of templates) {
			this.templateProgram.uniforms.uScale.value = new Vec2(
				this.scale[0] * template.image.width / width,
				this.scale[1] * template.image.height / height,
			);
			this.templateProgram.uniforms.uTranslate.value = new Vec2(
				(this.translate[0] + Math.round(template.x) / width) * width / template.image.width,
				// This will probably get better if canvas begins working in
				// pixel-space rather than 0.0 – 1.0. Until then: 🤢
				(this.translate[1] + 1 - (template.image.height + Math.round(template.y)) / height) * height / template.image.height,
			);
			this.templateProgram.uniforms.tTemplate.value = template.image;
			this.templateProgram.uniforms.uTemplateSize.value = new Vec2(
				template.image.width,
				template.image.height,
			);
			this.renderer.render({
				scene: this.templateMesh,
			});
		}
	}

	private lastRenderOptions?: RenderSettings;

	async render(options = this.lastRenderOptions) {
		if (options === undefined) {
			options = DEFAULT_RENDER_SETTINGS;
		}
		this.lastRenderOptions = options;

		const renderInfo = await this.prepareToRender();
		
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
		
		// TODO: move into render functions using settings access.
		this.program.uniforms.uTimestampRange.value = options.timestampRange;
		this.program.uniforms.uHeatmapDim.value = 1 - options.heatmapDim;
		this.templateProgram.uniforms.uHeatmapDim.value = 1 - options.heatmapDim;

		this.renderCanvas(renderInfo);
		this.renderTemplates(renderInfo, options.templates);
	}
}