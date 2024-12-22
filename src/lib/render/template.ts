import { Mesh, Renderer, RenderTarget, Texture, Vec2, type OGLRenderingContext } from "ogl";
import { InstancedQuad } from "./gl";
import { ConversionProgram, Conversion } from "./program/conversion";
import { updateAttribute } from "../util";

let mesh: Mesh | undefined;
let program: ConversionProgram | undefined;
function scene(gl: OGLRenderingContext): { mesh: Mesh; program: ConversionProgram } {
	if (typeof program === "undefined" || program.gl !== gl) {
		program = new ConversionProgram(gl);
	}

	if (typeof mesh === "undefined" || mesh.gl !== gl) {
		const geometry = new InstancedQuad(gl);
		// set the instanced attributes once to only render one quad
		updateAttribute(geometry.attributes.offset, [new Vec2(-0.5, -0.5)]);
		updateAttribute(geometry.attributes.texture, [0]);
		updateAttribute(geometry.attributes.size, [new Vec2(0.5, 0.5)]);
		mesh = new Mesh(gl, { geometry, program });
	}

	return { mesh, program };
}

export class Template {
	private base?: Texture;
	private processed?: RenderTarget;

	private readonly image: HTMLImageElement;

	private currentWidth: number;
	private currentHeight: number;
	private currentConversion: Conversion;

	constructor(
		src?: string,
		public x: number = 0,
		public y: number = 0,
		public title: string = "",
		initialWidth: number = 0,
		initialHeight: number = 0,
		initialConversion: Conversion = Conversion.CIEDE2000,
	) {
		this.image = new Image();
		this.image.crossOrigin = "anonymous";
		this.image.onload = () => {
			this.base = undefined;
			this.processed = undefined;
			if (this.currentWidth === 0 && this.currentHeight === 0) {
				this.currentWidth = this.image.width;
			}
		};
		this.url = src;

		this.currentWidth = initialWidth;
		this.currentHeight = initialHeight;
		this.currentConversion = initialConversion;
	}

	set url(value: string | undefined) {
		if (typeof value === "undefined") {
			this.image.removeAttribute("src");
		} else {
			this.image.src = value;
		}
	}

	get url(): string {
		return this.image.src;
	}

	set width(value: number) {
		this.currentWidth = value;
		this.processed = undefined;
	}

	get width(): number {
		return this.currentWidth;
	}

	set height(value: number) {
		this.currentHeight = value;
		this.processed = undefined;
	}

	get height(): number {
		if (this.currentHeight === 0) {
			return this.currentWidth / this.image.width * this.image.height;
		} else {
			return this.currentHeight;
		}
	}

	set conversion(value: Conversion) {
		this.currentConversion = value;
		this.processed = undefined;
	}

	get conversion(): Conversion {
		return this.currentConversion;
	}

	prepare(
		renderer: Renderer,
		palette: Texture,
	): Texture {
		const gl = renderer.gl;

		if (typeof this.base === "undefined") {
			const image = this.image;
			const { width, height } = image;
			const format = gl.RGBA;
			this.base = new Texture(gl, {
				image,
				width,
				height,
				format,
				minFilter: gl.NEAREST,
				magFilter: gl.NEAREST,
			});
		}

		if (typeof this.processed === "undefined") {
			const { base, width, height } = this;

			const { mesh, program } = scene(gl);

			program.uniforms.tPalette.value = palette;
			program.uniforms.uPaletteSize.value = palette.width;
			program.uniforms.tInput.value = base;
			program.uniforms.uInputSize.value = new Vec2(base.width, base.height);
			program.uniforms.uOutputSize.value = new Vec2(width, height);

			this.processed = new RenderTarget(gl, {
				width,
				height,
				minFilter: gl.NEAREST,
				magFilter: gl.NEAREST,
				depth: false,
			});

			renderer.render({ scene: mesh, target: this.processed });
		}

		return this.processed.texture;
	}
}
