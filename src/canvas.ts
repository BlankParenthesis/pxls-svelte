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
	
	varying vec2 vUv;

	uniform sampler2D tPalette;
	uniform sampler2D tCanvas;

	void main() {
		vec4 canvasdata = texture2D(tCanvas, vUv);
		float index = floor(canvasdata.r * 255.0 + 0.5) / 3.0;
		gl_FragColor = texture2D(tPalette, vec2(index, 0.0));
	}
`;

const QUAD = [
	-1, 1,
	-1, -1,
	1, 1,
	1, -1,
	1, 1,
	-1, -1,
];
const QUAD_NORMALS = [
	0, 1,
	0, 0,
	1, 1,
	1, 0,
	1, 1,
	0, 0,
];

class CanvasGeometry extends Geometry {
	constructor(gl: OGLRenderingContext, size: number) {
		const sizeOffset = (size - 1) / 2;
		const spreadX = new Array(size)
			.fill(QUAD)
			.map((quad: number[], i) => {
				const position = i - sizeOffset;
				return quad.map((coord, i2) => {
					if (i2 % 2 === 0) {
						return coord + position * 2;
					} else {
						return coord;
					}
				});
			})
			.flat();
		const spreadXY = new Array(size)
			.fill(spreadX)
			.map((quad: number[], i) => {
				const position = i - sizeOffset;
				return quad.map((coord, i2) => {
					if (i2 % 2 === 1) {
						return coord + position * 2;
					} else {
						return coord;
					}
				});
			})
			.flat();

		super(gl, {
			position: { size: 2, data: new Float32Array(spreadXY) },
			uv: {
				size: 2,
				data: new Float32Array(
					new Array(size * size)
						.fill(QUAD_NORMALS)
						.flat(),
				),
			},
		});
	}
}

export class Canvas {
	private readonly renderer: Renderer;
	private readonly program: Program;
	private meshNumQuads: number;
	private mesh: Mesh;

	scale = new Vec2(0.5, 0.5);
	translate = new Vec2(0, 0);

	constructor(canvas?: HTMLCanvasElement) {
		this.renderer = new Renderer({ canvas });
		
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

		const canvasdata = new Texture(gl, {
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});
		const canvasdataImage = new Image();
		canvasdataImage.onload = () => {
			canvasdata.image = canvasdataImage;
			this.render();
		};
		canvasdataImage.src = "./canvas.png"

		this.program = new Program(gl, {
			vertex: VERTEX_SHADER,
			fragment: FRAGMENT_SHADER,
			uniforms: {
				uTranslate: { value: new Vec2(this.translate[0], this.translate[1]) },
				uScale: { value: new Vec2(this.scale[0], this.scale[1]) },
				tPalette: { value: palette },
				tCanvas: { value: canvasdata },
			},
		});
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

	render(options = {
		scaleBase: 3,
		detailLevel: 0,
		autoDetail: false,
		renderIdentity: false,
	}) {
		if (options.autoDetail) {
			const minScale = Math.min(this.scale[0], this.scale[1]);
			options.detailLevel = Math.max(0, Math.floor(Math.log(minScale) / Math.log(options.scaleBase)));
		}

		if (this.meshNumQuads !== options.scaleBase) {
			// reconstruct mesh
			this.meshNumQuads = options.scaleBase;
			const geometry = new CanvasGeometry(this.renderer.gl, this.meshNumQuads);
			this.mesh = new Mesh(this.renderer.gl, { geometry, program: this.program });
		}

		return requestAnimationFrame((timestamp: DOMHighResTimeStamp) => {
			const scaleModifier = options.scaleBase ** options.detailLevel;
	
			this.program.uniforms.uTranslate.value = new Vec2(...[this.translate[0], this.translate[1]].map(translate => {
				const scaledTranslate = translate * scaleModifier;
				// The rounding of modulo means that our translate will always
				// be off-center towards the origin. This shifts it away from
				// the origin by that offset.
				const offset = Math.sign(Math.trunc(scaledTranslate));
				// Worked this out through experimenting, so I don't know quite why.
				// this works.
				// Update: I still don't know why it works, but I did some more
				// experimenting and it seems more correct now.
				// Also the control flow and naming is a bit more clear:
				// this condition is more obviously a type of clipping.
				const scaleEdge = options.scaleBase ** (options.detailLevel + 1);
				if (Math.abs(scaledTranslate + offset) >= (scaleEdge + 2 - options.scaleBase)) {
					return scaledTranslate - (scaleEdge - options.scaleBase) * Math.sign(scaledTranslate);
				} else {
					return (scaledTranslate + offset) % 2 - offset;
				}
			}));
			this.program.uniforms.uScale.value = new Vec2(...[this.scale[0], this.scale[1]].map(scale => {
				return scale / scaleModifier;
			}));
	
			this.renderer.autoClear = options.renderIdentity;
			this.renderer.render({
				scene: this.mesh,
			});
	
			if (options.renderIdentity) {
				this.program.uniforms.uTranslate.value = this.translate;
				this.renderer.autoClear = false;
				this.program.uniforms.uScale.value = this.scale;
				this.renderer.render({
					scene: this.mesh,
				});
			}
		})
	}
}