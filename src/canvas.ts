import { Geometry, Texture, Vec2, Renderer, Program, Mesh } from "ogl-typescript";

const vertex = /* glsl */ `
	attribute vec2 position;
	attribute vec2 uv;
	attribute float bufferSource;

	varying vec2 vUv;

	uniform vec2 uTranslate;
	uniform vec2 uScale;

	void main() {
		vUv = uv;
		gl_Position = vec4(uScale * (position + uTranslate), 0.0, 1.0);
	}
`;

const fragment = /* glsl */ `
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
const SCALE_BASE = 3;

export class Canvas {
	private readonly renderer: Renderer;
	private readonly program: Program;
	private readonly mesh: Mesh;

	scale = new Vec2(0.5, 0.5);
	translate = new Vec2(0, 0);

	constructor(canvas?: HTMLCanvasElement) {
		this.renderer = new Renderer({ canvas });
		
		const gl = this.renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		// 3×3 quad grid
		const geometry = new Geometry(gl, {
			position: { size: 2, data: new Float32Array([
				...QUAD.map((c) => c - 2),
				...QUAD.map((c, i) => i % 2 ? c - 2 : c),
				...QUAD.map((c, i) => i % 2 ? c - 2 : c + 2),
				...QUAD.map((c, i) => i % 2 ? c : c - 2),
				...QUAD,
				...QUAD.map((c, i) => i % 2 ? c: c + 2),
				...QUAD.map((c, i) => i % 2 ? c + 2 : c - 2),
				...QUAD.map((c, i) => i % 2 ? c + 2 : c),
				...QUAD.map((c) => c + 2),
			]) },
			uv: { size: 2, data: new Float32Array([
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
				...QUAD_NORMALS,
			]) },
		});

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
			vertex,
			fragment,
			uniforms: {
				uTranslate: { value: new Vec2(this.translate[0], this.translate[1]) },
				uScale: { value: new Vec2(this.scale[0], this.scale[1]) },
				tPalette: { value: palette },
				tCanvas: { value: canvasdata },
			},
		});
		
		this.mesh = new Mesh(gl, { geometry, program: this.program });
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
		detailLevel: 0,
		autoDetail: false,
		renderIdentity: false,
	}) {
		if (options.autoDetail) {
			const minScale = Math.min(this.scale[0], this.scale[1]);
			options.detailLevel = Math.max(0, Math.floor(Math.log(minScale) / Math.log(SCALE_BASE)));
		}

		return requestAnimationFrame((timestamp: DOMHighResTimeStamp) => {
	
			const scaleModifier = SCALE_BASE ** options.detailLevel;
	
			this.program.uniforms.uTranslate.value = new Vec2(...[this.translate[0], this.translate[1]].map(translate => {
				// Tiles are -1 to 1 (a length of 2).
				// So our magic numbers of 2 here are tile length.
				let excess = 0;
				let scaledTranslate = translate * scaleModifier
				// Worked this out through experimenting, so I don't know quite why.
				// this works.
				const scaleEdge = SCALE_BASE ** (options.detailLevel + 1) - 1;
				if (Math.abs(scaledTranslate) >= scaleEdge) {
					// Since I don't know why scaleEdge is what it is, I don't quite 
					// know why it works out here. Though I imagine the -2 is actually
					// a -3 when combined with the -1 on scaleEdge, which would be -scaleBase.
					// Yay; programming through trial-and-error.
					excess = scaledTranslate - (scaleEdge - 2) * Math.sign(scaledTranslate);
					scaledTranslate = 0;
				}
				return scaledTranslate % 2 + excess;
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