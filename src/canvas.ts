import { Geometry, Texture, Vec2, Renderer, Program, Mesh, OGLRenderingContext } from "ogl-typescript";

const VERTEX_SHADER = /* glsl */ `
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

const FRAGMENT_SHADER = /* glsl */ `
	precision highp float;

	#define OUTLINE_COL1 vec3(0.1)
	#define OUTLINE_COL2 vec3(0.9, 0.8, 0.3)
	
	varying vec2 vUv;

	uniform sampler2D tPalette;
	uniform sampler2D tCanvas;
	uniform float uOutline;
	uniform float uOutlineStripe;

	void main() {
		vec2 magnitude = abs(vUv - 0.5);
		if (magnitude.x > uOutline || magnitude.y > uOutline) {
			float colorSelector = sin((vUv.x + vUv.y) * uOutlineStripe) > 0.16 ? 1.0 : 0.0;
			gl_FragColor = vec4(mix(OUTLINE_COL1, OUTLINE_COL2, colorSelector), 1.0);
		} else {
			vec4 canvasdata = texture2D(tCanvas, vUv);
			float index = floor(canvasdata.r * 255.0 + 0.5) / 3.0;
			gl_FragColor = texture2D(tPalette, vec2(index, 0.0));
		}
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

const QUAD = [
	0, 1,
	0, 0,
	1, 1,
	1, 0,
	1, 1,
	0, 0,
];
const QUAD_NORMALS = [
	0, 1,
	0, 0,
	1, 1,
	1, 0,
	1, 1,
	0, 0,
];

export type Shape = Array<[number, number]>;
export const DEFAULT_SHAPE: Shape = [[5, 4], [2, 2], [8, 8]];
export type RenderSettings = {
	detailLevel: number,
	autoDetail: boolean,
	renderIdentity: boolean,
	outline: number,
	outlineStripe: number,
};
export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
	detailLevel: 1,
	autoDetail: true,
	renderIdentity: false,
	outline: 0.05,
	outlineStripe: 8,
};
export type Palette = Array<[number, number, number, number]>
export const DEFAULT_PALETTE = [
	[255, 255, 255, 255],
	[30, 120, 255, 255],
	[255, 120, 180, 255],
	[100, 255, 140, 255],
];

class LoDSampler {
	readonly levels: Array<Texture[][]>;
	readonly width: number;
	readonly height: number;

	constructor(gl: OGLRenderingContext, shape: Shape) {
		this.width = shape.reduce((width, dim) => width * dim[0], 1);
		this.height = shape.reduce((height, dim) => height * dim[1], 1);

		const imageData = new Array(this.width * this.height)
			.fill(null)
			.map(() => Math.floor(Math.random() * DEFAULT_PALETTE.length));

		const configuration = new Array(shape.length)
			.fill(shape)
			.map((shape: Shape, lod) => {
				const chunkArragement = shape
					.slice(0, lod)
					.reduce((acc, next) => [acc[0] * next[0], acc[1] * next[1]], [1, 1]);
				const chunkSize = shape
					.slice(lod, shape.length)
					.reduce((acc, next) => [acc[0] * next[0], acc[1] * next[1]], [1, 1]);

				return {
					chunkCountX: chunkArragement[0],
					chunkCountY: chunkArragement[1],
					textureSettings: {
						width: chunkSize[0],
						height: chunkSize[1],
						magFilter: gl.NEAREST,
						minFilter: gl.NEAREST,
					},
				};
			});

		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

		const imageWidth = this.width;
		this.levels = configuration.map(({ chunkCountX, chunkCountY, textureSettings }) => 
			new Array(chunkCountY)
				.fill(null)
				.map((_, chunkY) => new Array(chunkCountX)
					.fill(null)
					.map((_, chunkX) => {
						const { width, height, magFilter, minFilter } = textureSettings;
						
						const chunkPos = (chunkX * width) + (chunkY * width * height * chunkCountX);
						const image = new Uint8Array(
							new Array(height)
								.fill(null)
								.map((_, y) => imageData.slice(
									chunkPos + y * imageWidth,
									chunkPos + y * imageWidth + width,
								))
								.flat(),
						);

						return new Texture(gl, {
							image,
							width,
							height,
							magFilter,
							minFilter,
							format: gl.LUMINANCE,
							internalFormat: gl.LUMINANCE,
						});
					}),
				),
		);

		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
	}
}

type Uniforms = {
	uTranslate: { value: Vec2 };
	uScale: { value: Vec2 };
	uOutline: { value: number };
	uOutlineStripe: { value: number };
	tPalette: { value: Texture };
	tCanvas: { value: Texture };
};
type CanvasProgram = Program & { uniforms: Uniforms };

export class Canvas {
	private readonly renderer: Renderer;
	private readonly program: CanvasProgram;
	private meshNumQuads: number;
	private mesh: Mesh;
	private samplers: LoDSampler;

	zoomScale = new Vec2(0.5, 0.5);
	screenScale = new Vec2(1, 1);
	ratioScale = new Vec2(1, 1);
	translate = new Vec2(-0.5, -0.5);

	constructor(canvas?: HTMLCanvasElement) {
		this.renderer = new Renderer({ canvas, autoClear: false });
		
		const gl = this.renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		const palette = new Texture(gl, {
			image: new Uint8Array(DEFAULT_PALETTE.flat()),
			width: DEFAULT_PALETTE.length,
			height: 1,
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});

		this.samplers = new LoDSampler(gl, DEFAULT_SHAPE);

		const uniforms: Uniforms = {
			uTranslate: { value: new Vec2(this.translate[0], this.translate[1]) },
			uScale: { value: new Vec2(this.scale[0], this.scale[1]) },
			uOutline: { value: 0 },
			uOutlineStripe: { value: 8 },
			tPalette: { value: palette },
			tCanvas: { value: new Texture(gl) },
		};

		this.program = new Program(gl, {
			vertex: VERTEX_SHADER,
			fragment: FRAGMENT_SHADER,
			uniforms,
		}) as CanvasProgram;
		const geometry = new Geometry(gl, {
			position: { size: 2, data: new Float32Array(QUAD) },
			uv: { size: 2, data: new Float32Array(QUAD_NORMALS) },
		});
		this.mesh = new Mesh(this.renderer.gl, { geometry, program: this.program });
	}

	reshape(shape: Shape) {
		this.samplers = new LoDSampler(this.renderer.gl, shape);
		this.setSize(this.renderer.gl.canvas.width, this.renderer.gl.canvas.height);
	}

	get scale() {
		return new Vec2(
			this.zoomScale[0] * this.screenScale[0] * this.ratioScale[0],
			this.zoomScale[1] * this.screenScale[1] * this.ratioScale[1],
		)
	}

	setSize(width: number, height: number) {
		if (this.renderer.gl.canvas.width !== width || this.renderer.gl.canvas.height !== height) {
			this.renderer.setSize(width, height);
			
			if (width > height) {
				this.screenScale[0] = 1;
				this.screenScale[1] = width / height;
			} else {
				this.screenScale[0] = height / width;
				this.screenScale[1] = 1;
			}
		}

		if(this.samplers.width > this.samplers.height) {
			this.ratioScale[0] = this.samplers.width / this.samplers.height;
			this.ratioScale[1] = 1;
		} else {
			this.ratioScale[0] = 1;
			this.ratioScale[1] = this.samplers.height / this.samplers.width;
		}
	}

	private renderIdentity() {
		this.program.uniforms.uTranslate.value = this.translate;
		this.program.uniforms.uScale.value = this.scale;
		this.program.uniforms.tCanvas.value = this.samplers.levels[0][0][0];
		this.renderer.render({
			scene: this.mesh,
		});
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
		options.detailLevel = detailLevel = Math.max(0, Math.min(detailLevel, this.samplers.levels.length - 1));

		return requestAnimationFrame((timestamp: DOMHighResTimeStamp) => {
			this.program.uniforms.uOutline.value = 0.5 - (options.outline / 2);
			this.program.uniforms.uOutlineStripe.value = options.outlineStripe * Math.PI * 2;

			if (detailLevel > 0) {
				const lod = this.samplers.levels[detailLevel];

				const scaleModifier = [lod[0].length, lod.length];
				const translate = new Vec2(...[this.translate[0], this.translate[1]].map((translate, i) => {
					const scaledTranslate = translate * scaleModifier[i];
					
					const offset = scaledTranslate > -0.5 ? 1.5 : 0.5;

					return (scaledTranslate + offset) % 1 - offset;
				}));
				this.program.uniforms.uScale.value = new Vec2(...[this.scale[0], this.scale[1]].map((scale, i) => {
					return scale / scaleModifier[i];
				}));

				const x = -fromTranslateToTile(this.translate[0], scaleModifier[0]);
				const y = scaleModifier[1] + fromTranslateToTile(this.translate[1], scaleModifier[1]) - 1;

				
				this.renderer.gl.clear(this.renderer.gl.COLOR_BUFFER_BIT | this.renderer.gl.DEPTH_BUFFER_BIT);

				for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
					const ox = x + dx;
					const oy = y - dy;
					if (lod[oy] && lod[oy][ox]) {
						this.program.uniforms.uTranslate.value = new Vec2(translate[0] + dx, translate[1] + dy);
						this.program.uniforms.tCanvas.value = lod[oy][ox];
						
						this.renderer.render({
							scene: this.mesh,
						});
					}
				}
			} else {
				this.program.uniforms.uTranslate.value = new Vec2(this.translate[0], this.translate[1]);
				this.program.uniforms.uScale.value = this.scale;
				this.program.uniforms.tCanvas.value = this.samplers.levels[0][0][0];
				this.renderer.render({
					scene: this.mesh,
					clear: true,
				});
			}

			if (options.renderIdentity) {
				this.renderIdentity();
			}
		})
	}
}