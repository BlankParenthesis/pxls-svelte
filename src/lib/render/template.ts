import { Mesh, Renderer, RenderTarget, Texture, Vec2, type OGLRenderingContext } from "ogl";
import { InstancedQuad } from "./gl";
import { ConversionProgram, Conversion } from "./program/conversion";
import { updateAttribute } from "../util";
import { z } from "zod";

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

export const Templates = (board: URL) => z.array(z.object({
	src: z.string(),
	title: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number().min(0),
	height: z.number().min(0).optional().nullable().default(0),
	show: z.boolean(),
	conversion: z.number(),
})).transform(ts => ts.map(t => new Template(
	board,
	t.src,
	t.show,
	t.x,
	t.y,
	t.title,
	t.width,
	t.height === null ? undefined : t.height,
	t.conversion,
)));
export type Templates = z.infer<ReturnType<typeof Templates>>;

export class Template {
	private base?: Texture;
	private processed?: RenderTarget;

	private readonly image: HTMLImageElement;

	private currentWidth: number;
	private currentHeight: number;
	private currentConversion: Conversion;

	constructor(
		private boardUrl: URL,
		src?: string,
		public show: boolean = true,
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

	get link(): URL {
		const parameters = {
			board: this.boardUrl.pathname,
			tname: this.title,
			tx: this.x,
			ty: this.y,
			tw: this.currentWidth,
			th: this.currentHeight,
			tconv: this.conversion,
			tsrc: this.url,
		};

		const url = new URL(location.href);
		url.hash = Object.entries(parameters)
			.filter(([_, v]) => typeof v !== "undefined")
			.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
			.join("&");

		return url;
	}

	serialize() {
		return {
			src: this.url,
			show: this.show,
			x: this.x,
			y: this.y,
			title: this.title,
			width: this.currentWidth,
			height: this.currentHeight,
			conversion: this.conversion,
		};
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
