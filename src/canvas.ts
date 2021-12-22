import { Texture, Vec2, Renderer, Program, Mesh, OGLRenderingContext } from "ogl-typescript";
import { QUAD_VERTEX_SHADER, Quad } from "./gl";
import { newTemplateProgram, Template, TemplateProgram } from "./template";

const CANVAS_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D tPalette;
uniform float uPaletteSize;
uniform sampler2D tCanvas;

void main() {
	vec4 canvasdata = texture2D(tCanvas, vUv);
	float index = floor(canvasdata.r * 255.0 + 0.5);
	gl_FragColor = texture2D(tPalette, vec2(index / uPaletteSize, 0.0));
}
`;

function fromTranslateToTile(coord, scaleModifier) {
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

export type Shape = Array<[number, number]>;
export const DEFAULT_SHAPE: Shape = [[1, 1],[4, 4], [200, 200]];
export type RenderSettings = {
	detailLevel: number,
	autoDetail: boolean,
	templates: Template[],
};
export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
	detailLevel: 1,
	autoDetail: true,
	templates: [],
};
export type Palette = Array<[number, number, number, number]>
export const DEFAULT_PALETTE = [
	[255, 255, 255, 255],
	[30, 120, 255, 255],
	[255, 120, 180, 255],
	[100, 255, 140, 255],
];

type ChunkMetadata = {
	gl: OGLRenderingContext;
	arrangementWidth: number;
	arrangementHeight: number;
	pixelsWidth: number;
	pixelsHeight: number;
};

class Sampler {
	private texture?: Texture = null;

	constructor(
		// There's going to be quite a few of these Sampler objects.
		// They could all store copies of all the metadata in a flat structure,
		// but since they share the same data, it's more memory efficient for them
		// all to store a reference to a shared object.
		private readonly chunkMetadata: ChunkMetadata,
	) {}

	load(x: number, y: number): Texture {
		if(this.texture === null) {
			const gl = this.chunkMetadata.gl;
			const width = this.chunkMetadata.pixelsWidth;
			const height = this.chunkMetadata.pixelsHeight;
			this.texture = new Texture(gl, {
				image: new Uint8Array(
					new Array(width * height)
						.fill(null)
						.map((_, i) => (x * width + i % width) % 4),
				),
				width,
				height,
				minFilter: gl.NEAREST,
				magFilter: gl.NEAREST,
				format: gl.LUMINANCE,
				internalFormat: gl.LUMINANCE,
			});
		}
		return this.texture;
	}

	get loaded() {
		return this.texture !== null;
	}

	unload() {
		if (this.loaded) {
			this.texture
			this.texture = null;
		}
	}
}

class LoDSampler {
	readonly levels: Array<Sampler[][]>;
	readonly width: number;
	readonly height: number;

	constructor(gl: OGLRenderingContext, shape: Shape) {
		this.width = shape.reduce((width, dim) => width * dim[0], 1);
		this.height = shape.reduce((height, dim) => height * dim[1], 1);

		const configuration: ChunkMetadata[] = new Array(shape.length)
			.fill(shape)
			.map((shape: Shape, lod) => {
				const chunkArragement = shape
					.slice(0, lod)
					.reduce((acc, next) => [acc[0] * next[0], acc[1] * next[1]], [1, 1]);
				const chunkSize = shape
					.slice(lod, shape.length)
					.reduce((acc, next) => [acc[0] * next[0], acc[1] * next[1]], [1, 1]);

				return {
					gl,
					arrangementWidth: chunkArragement[0],
					arrangementHeight: chunkArragement[1],
					pixelsWidth: chunkSize[0],
					pixelsHeight: chunkSize[1],
				};
			});

		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

		this.levels = configuration.map(meta => 
			new Array(meta.arrangementHeight)
				.fill(null)
				.map((_, chunkY) => new Array(meta.arrangementWidth)
					.fill(null)
					.map((_, chunkX) => {
						return new Sampler(meta);
					}),
				),
		);

		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
	}
}

type CanvasUniforms = {
	uTranslate: { value: Vec2 };
	uScale: { value: Vec2 };
	uOutline: { value: number };
	uOutlineStripe: { value: number };
	tPalette: { value: Texture };
	uPaletteSize: { value: number };
	tCanvas: { value: Texture };
};
type CanvasProgram = Program & { uniforms: CanvasUniforms };

export class Canvas {
	private readonly renderer: Renderer;
	private readonly program: CanvasProgram;
	private readonly templateProgram: TemplateProgram;
	private mesh: Mesh;
	private templateMesh: Mesh;
	private samplers: LoDSampler;

	zoomScale = new Vec2(1, 1);
	screenScale = new Vec2(1, 1);
	ratioScale = new Vec2(1, 1);
	translate = new Vec2(-0.5, -0.5);

	get gl() {
		return this.renderer.gl;
	}

	get width() {
		return this.samplers.width;
	}

	get height() {
		return this.samplers.height;
	}

	constructor(canvas?: HTMLCanvasElement) {
		this.renderer = new Renderer({
			canvas,
			autoClear: false,
			depth: false,
		});
		const gl = this.gl;

		gl.clearColor(0, 0, 0, 1);

		const palette = new Texture(gl, {
			image: new Uint8Array(DEFAULT_PALETTE.flat()),
			width: DEFAULT_PALETTE.length,
			height: 1,
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});

		this.samplers = new LoDSampler(gl, DEFAULT_SHAPE);

		const uniforms: CanvasUniforms = {
			uTranslate: { value: new Vec2(this.translate[0], this.translate[1]) },
			uScale: { value: new Vec2(this.scale[0], this.scale[1]) },
			uOutline: { value: 0 },
			uOutlineStripe: { value: 8 },
			tPalette: { value: palette },
			uPaletteSize: { value: palette.width },
			tCanvas: { value: new Texture(gl) },
		};

		this.program = new Program(gl, {
			vertex: QUAD_VERTEX_SHADER,
			fragment: CANVAS_FRAGMENT_SHADER,
			uniforms,
		}) as CanvasProgram;

		this.templateProgram = newTemplateProgram(gl, palette);

		const geometry = new Quad(gl);
		this.mesh = new Mesh(this.gl, { geometry, program: this.program });
		this.templateMesh = new Mesh(this.gl, { geometry, program: this.templateProgram });
	}

	reshape(shape: Shape) {
		this.samplers = new LoDSampler(this.gl, shape);
		this.setSize(this.gl.canvas.width, this.gl.canvas.height);
	}

	get scale() {
		return new Vec2(
			this.zoomScale[0] * this.screenScale[0] * this.ratioScale[0],
			this.zoomScale[1] * this.screenScale[1] * this.ratioScale[1],
		)
	}

	setSize(width: number, height: number) {
		if (this.gl.canvas.width !== width || this.gl.canvas.height !== height) {
			this.renderer.setSize(width, height);
			
			if (width > height) {
				this.screenScale[0] = 1;
				this.screenScale[1] = width / height;
			} else {
				this.screenScale[0] = height / width;
				this.screenScale[1] = 1;
			}
		}

		if(this.width > this.height) {
			this.ratioScale[0] = this.width / this.height;
			this.ratioScale[1] = 1;
		} else {
			this.ratioScale[0] = 1;
			this.ratioScale[1] = this.height / this.width;
		}
	}

	render(options = DEFAULT_RENDER_SETTINGS) {
		let detailLevel = options.detailLevel;
		if (options.autoDetail) {
			detailLevel = 0;
			let [x, y] = this.scale;
			x /= 2;
			y /= 2;
			let lod = this.samplers.levels[detailLevel + 1];
			while (lod && x > lod[0].length && y > lod.length) {
				detailLevel += 1;
				lod = this.samplers.levels[detailLevel + 1];
			}
		}
		options.detailLevel = detailLevel = Math.max(1, Math.min(detailLevel, this.samplers.levels.length - 1));
		
		return requestAnimationFrame((timestamp: DOMHighResTimeStamp) => {
			this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);			

			if (detailLevel > 0) {
				const lod = this.samplers.levels[detailLevel];

				const scaleModifier = [lod[0].length, lod.length];
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
					if (lod[oy] && lod[oy][ox]) {
						this.program.uniforms.uTranslate.value = new Vec2(translate[0] + dx, translate[1] + dy);
						this.program.uniforms.tCanvas.value = lod[oy][ox].load(ox, oy);
						
						this.renderer.render({
							scene: this.mesh,
						});
					}
				}

				const radius = 2;

				for (let oy = 0; oy < lod.length; oy++) {
					for (let ox = 0; ox < lod[oy].length; ox++) {
						if (lod[oy][ox].loaded && (Math.abs(y - oy) > radius || Math.abs(x - ox) > radius)) {
							lod[oy][ox].unload();
						}
					}
				}
			} else {
				this.program.uniforms.uTranslate.value = new Vec2(this.translate[0], this.translate[1]);
				this.program.uniforms.uScale.value = this.scale;
				this.program.uniforms.tCanvas.value = this.samplers.levels[0][0][0].load(0, 0);
				this.renderer.render({
					scene: this.mesh,
				});
			}

			for (const template of options.templates) {
				this.templateProgram.uniforms.uScale.value = new Vec2(
					this.scale[0] * template.image.width / this.width,
					this.scale[1] * template.image.height / this.height,
				);
				this.templateProgram.uniforms.uTranslate.value = new Vec2(
					(this.translate[0] + Math.round(template.x) / this.width) * this.width / template.image.width,
					// This will probably get better if canvas begins working in
					// pixel-space rather than 0.0 – 1.0. Until then: 🤢
					(this.translate[1] + 1 - (template.image.height + Math.round(template.y)) / this.height) * this.height / template.image.height,
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
		})
	}
}