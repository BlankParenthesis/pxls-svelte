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

const SHAPE: Array<[number, number]> = [[2,2], [2,2], [4,4]];

type Shape = Array<[number, number]>;

class Sampler {
	readonly texture: Texture;
	private readonly image: HTMLImageElement;

	constructor(gl: OGLRenderingContext) {
		const image = this.image = new Image();
		const texture = this.texture = new Texture(gl, {
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});
		image.onload = () => {
			texture.image = image;
		};
	}

	load(src?: string) {
		if (src === null) {
			this.texture.image = undefined;
		} else{
			this.image.src = src;
		}
	}
}

class LoDSampler {
	levels: Array<Sampler[][]>;

	constructor(gl: OGLRenderingContext, shape: Shape) {
		const dimensions = shape
			.slice(0, shape.length - 1)
			.map((_, i, shape) => shape.slice(i))
			.reverse()
			.map(sizes => sizes.reduce((acc, next) => [acc[0] * next[0], acc[1] * next[1]], [1, 1]));

		dimensions.unshift([1, 1]);

		this.levels = new Array(dimensions.length) as Array<Sampler[][]>;
		for (const [detail, [width, height]] of dimensions.entries()) {
			this.levels[detail] = new Array(height)
				.fill(null)
				.map(_ => new Array(width)
					.fill(null)
					.map(_ => new Sampler(gl)),
				)
		}

		console.debug(this.levels);
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

	scale = new Vec2(0.5, 0.5);
	translate = new Vec2(-0.5, -0.5);

	constructor(canvas?: HTMLCanvasElement) {
		this.renderer = new Renderer({ canvas, autoClear: false });
		
		const gl = this.renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		const palette = new Texture(gl, {
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});
		const paletteImage = new Image();
		paletteImage.onload = () => {
			palette.image = paletteImage;
			this.render();
		};
		paletteImage.src = "./palette.png"

		this.samplers = new LoDSampler(gl, SHAPE);

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

	setSize(width: number, height: number) {
		this.renderer.setSize(width, height);
		
		// sets the aspect ratio to match screen.
		if (this.scale[0] > this.scale[1]) {
			this.scale[0] = this.scale[1] * window.innerHeight / window.innerWidth;
		} else {
			this.scale[1] = this.scale[0] * window.innerWidth / window.innerHeight;
		}
	}

	private renderIdentity() {
		this.program.uniforms.uTranslate.value = this.translate;
		this.program.uniforms.uScale.value = this.scale;
		this.program.uniforms.tCanvas.value = this.samplers.levels[0][0][0].texture;
		this.renderer.render({
			scene: this.mesh,
		});
	}

	render(options = {
		detailLevel: 1,
		autoDetail: true,
		renderIdentity: false,
		outline: 0.05,
		outlineStripe: 8,
	}) {
		let detailLevel = options.detailLevel;
		if (options.autoDetail) {
			const minScale = Math.min(this.scale[0], this.scale[1]);
			if (minScale > 1) {
				const safeMargin = 2;
				const level = Math.log(minScale) / Math.log(2);
				detailLevel = Math.max(0, Math.ceil(level - safeMargin));
			} else {
				detailLevel = 0;
			}
		}
		detailLevel = Math.max(0, Math.min(detailLevel, this.samplers.levels.length - 1));

		return requestAnimationFrame((timestamp: DOMHighResTimeStamp) => {
			const scaleModifier = 2 ** detailLevel;
	
			this.program.uniforms.uOutline.value = 0.5 - (options.outline / 2);
			this.program.uniforms.uOutlineStripe.value = options.outlineStripe * Math.PI * 2;
			if (detailLevel > 0) {
				const translate = new Vec2(...[this.translate[0], this.translate[1]].map(translate => {
					const scaledTranslate = translate * scaleModifier;
					
					const offset = scaledTranslate > -0.5 ? 1.5 : 0.5;

					return (scaledTranslate + offset) % 1 - offset;
				}));
				this.program.uniforms.uScale.value = new Vec2(...[this.scale[0], this.scale[1]].map(scale => {
					return scale / scaleModifier;
				}));

				const x = -fromTranslateToTile(this.translate[0], scaleModifier);
				const y = scaleModifier + fromTranslateToTile(this.translate[1], scaleModifier) - 1;

				const levelSamplers = this.samplers.levels[detailLevel];
				
				this.renderer.gl.clear(this.renderer.gl.COLOR_BUFFER_BIT | this.renderer.gl.DEPTH_BUFFER_BIT);

				for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
					const ox = x + dx;
					const oy = y - dy;
					if (levelSamplers[ox] && levelSamplers[ox][oy]) {
						this.program.uniforms.uTranslate.value = new Vec2(translate[0] + dx, translate[1] + dy);
						this.program.uniforms.tCanvas.value = levelSamplers[ox][oy].texture;
						
						this.renderer.render({
							scene: this.mesh,
						});
					}
				}
			} else {
				this.program.uniforms.uTranslate.value = new Vec2(this.translate[0], this.translate[1]);
				this.program.uniforms.uScale.value = this.scale;
				this.program.uniforms.tCanvas.value = this.samplers.levels[0][0][0].texture;
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

	setSampler(level: number, x: number, y: number, src?: string) {
		this.samplers.levels[level][x][y].load(src);
	}
}