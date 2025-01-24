import { Texture, Vec2, Renderer, Mesh, Mat3, Program } from "ogl";
import type { Board } from "../board/board";
import { InstancedQuad } from "./gl";
import { Palette, toTexture } from "../board/palette";
import { Shape } from "./shape";
import { Template } from "./template";
import { CanvasTextures } from "./canvastextures";
import { ratio, updateAttribute, type Instanceable } from "../util";
import { TemplateProgram } from "./program/template";
import { CanvasProgram } from "./program/canvas";

export class ViewBox {
	readonly bottom: number;
	readonly left: number;
	readonly top: number;
	readonly right: number;
	constructor(view: {
		bottom: number;
		left: number;
		top: number;
		right: number;
	}) {
		this.bottom = view.bottom;
		this.left = view.left;
		this.top = view.top;
		this.right = view.right;
	}

	/**
	 * @param x x position in screen space from 0 to 1
	 * @param y y position in screen space from 0 to 1
	 * @returns the position on the board where [0, 0] is the top left and [1, 1] is the bottom right
	 */
	into(x: number, y: number): [number, number] {
		return [
			this.left + x * (this.right - this.left),
			this.top + y * (this.bottom - this.top),
		];
	}

	/**
	 * @param x x position in board space
	 * @param y y position in board space
	 * @returns the position in screen space where [0, 0] is the top left and [1, 1] is the bottom right
	 */
	outof(x: number, y: number): [number, number] {
		return [
			(x - this.left) / (this.right - this.left),
			(y - this.top) / (this.bottom - this.top),
		];
	}

	static default(): ViewBox {
		return new ViewBox({
			left: 0,
			right: 1,
			top: 0,
			bottom: 1,
		});
	}

	static fromTransform(transform: Mat3): ViewBox {
		const inverse = transform.inverse();

		// gl goes from bottom to top, but we want from top to bottom, so flip the y
		const bottomLeft = new Vec2(-1, 1).applyMatrix3(inverse);
		const topRight = new Vec2(1, -1).applyMatrix3(inverse);

		return new ViewBox({
			bottom: bottomLeft.y,
			left: bottomLeft.x,
			top: topRight.y,
			right: topRight.x,
		});
	}
};

export type RenderParameters = {
	transform: Mat3;
	templates: Template[];
	timestampStart: number;
	timestampEnd: number;
	heatmapDim: number;
};

export class Canvas {
	private palette: Texture;
	private readonly renderer: Renderer;
	private readonly program: CanvasProgram;
	private readonly templateProgram: TemplateProgram;
	private mesh: Mesh<InstancedQuad, CanvasProgram>;
	private templateMesh: Mesh<InstancedQuad, TemplateProgram>;
	private textures: CanvasTextures;

	private updateListeners: Array<() => void> = [];

	get gl() {
		return this.renderer.gl;
	}

	constructor(
		board: Board,
		private shape: Shape,
		palette: Palette,
		canvas: HTMLCanvasElement,
		templateStyle: HTMLImageElement,
	) {
		this.renderer = new Renderer({
			canvas,
			autoClear: false,
			depth: false,
			alpha: true,
			premultipliedAlpha: true,
			powerPreference: "low-power",
		});
		const gl = this.gl;

		this.palette = toTexture(gl, palette);

		gl.clearColor(0, 0, 0, 0);

		this.textures = new CanvasTextures(gl, board, shape, () => this.update());
		this.program = new CanvasProgram(gl);
		this.templateProgram = new TemplateProgram(gl, templateStyle);

		const geometry = new InstancedQuad(gl);
		this.mesh = new Mesh(this.gl, { geometry, program: this.program });
		this.templateMesh = new Mesh(this.gl, { geometry, program: this.templateProgram });
	}

	private update() {
		for (const callback of this.updateListeners) {
			callback();
		}
	}

	onUpdate(callback: () => void) {
		this.updateListeners.push(callback);
	}

	setSize(newWidth: number, newHeight: number) {
		if (this.gl.canvas.width !== newWidth || this.gl.canvas.height !== newHeight) {
			this.renderer.setSize(newWidth, newHeight);
			const screenScale = ratio(newWidth, newHeight);
			const boardScale = ratio(...this.shape.size());
			const scale = screenScale.multiply(boardScale);
			this.program.uniforms.uAspect.value = scale;
			this.templateProgram.uniforms.uAspect.value = scale;
		}
	}

	getAspect() {
		return this.program.uniforms.uAspect.value.clone();
	}

	/**
	 * @returns The viewbox relative to the top left of the unit board.
	 */
	private visibleArea(): ViewBox {
		const aspect = new Mat3().identity()
			.scale(this.program.uniforms.uAspect.value);
		const transform = new Mat3(...this.program.uniforms.uView.value)
			.multiply(aspect);

		return ViewBox.fromTransform(transform);
	}

	private detailLevel(visible: ViewBox): number {
		// NOTE: this is just 2 / scale for now, but in case the logic changes
		// in future, rely on `visible`.
		const width = visible.right - visible.left;
		const height = visible.bottom - visible.top;

		const maxDetail = this.shape.depth - 1;
		// NOTE: 1 by 1 is the size  of the board, and the widths here get
		// smaller as more sectors are added at higher detail levels.
		let [sectorWidth, sectorHeight] = [1, 1];
		for (let detail = 0; detail < maxDetail; detail++) {
			sectorWidth /= this.shape.get(detail)[0];
			sectorHeight /= this.shape.get(detail)[1];
			if (width > sectorWidth || height > sectorHeight) {
				return detail;
			}
		}

		return maxDetail;
	}

	private visibleSectors(visible: ViewBox, detail: number): Array<Vec2> {
		const [sectorWidth, sectorHeight] = this.shape.slice(0, detail).size();
		const clamped = (v: number, max: number) => Math.max(0, Math.min(v, max));
		const left = clamped(Math.floor(visible.left * sectorWidth), sectorWidth);
		const right = clamped(Math.ceil(visible.right * sectorWidth), sectorWidth);
		const top = clamped(Math.floor(visible.top * sectorHeight), sectorHeight);
		const bottom = clamped(Math.ceil(visible.bottom * sectorHeight), sectorHeight);

		const sectors = [];
		for (let y = top; y < bottom; y++) {
			for (let x = left; x < right; x++) {
				sectors.push(new Vec2(x, y));
			}
		}

		return sectors;
	}

	private updateUniforms(
		palette: Texture,
		parameters: RenderParameters,
	) {
		this.program.uniforms.uTimestampRange.value = new Vec2(parameters.timestampStart, parameters.timestampEnd);
		this.program.uniforms.uHeatmapDim.value = 1 - parameters.heatmapDim;
		this.program.uniforms.tPalette.value = palette;
		this.program.uniforms.uPaletteSize.value = palette.width;
		this.templateProgram.uniforms.uHeatmapDim.value = 1 - parameters.heatmapDim;
		this.templateProgram.uniforms.tPalette.value = palette;
		this.templateProgram.uniforms.uPaletteSize.value = palette.width;

		const view = new Mat3(...parameters.transform);
		this.program.uniforms.uView.value = view;
		this.templateProgram.uniforms.uView.value = view;

		const [width, height] = this.shape.size();
		this.templateProgram.uniforms.uBoardSize.value = new Vec2(width, height);
	}

	render(parameters: RenderParameters): ViewBox {
		this.updateUniforms(this.palette, parameters);

		type Scene = Mesh<InstancedQuad, Program & Instanceable>;
		const scene = this.mesh;
		const visible = this.visibleArea();

		let detail = this.detailLevel(visible);
		detail = Math.max(1, Math.min(detail, this.shape.depth - 1));

		const [width, height] = this.shape.slice(0, detail).size();
		updateAttribute(
			scene.geometry.attributes.size,
			Array(scene.program.maxParallelism).fill(new Vec2(width, height)),
		);

		const sectors = this.visibleSectors(visible, detail);
		console.assert(sectors.length <= 4, "More than 4 sectors were visible");
		sectors.splice(4);
		this.renderSectors(scene as Scene, sectors, detail);
		this.renderTemplates(this.palette, [...parameters.templates.filter(t => t.show)]);
		this.textures.prune();

		return this.visibleArea();
	}

	private renderSectors<P extends Program & Instanceable>(
		scene: Mesh<InstancedQuad, P>,
		sectors: Array<Vec2>,
		detail: number,
	) {
		this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

		const parallelism = scene.program.maxParallelism;
		const attributes = scene.geometry.attributes;
		while (sectors.length > 0) {
			const nextSet = sectors.splice(0, parallelism);
			updateAttribute(attributes.offset, nextSet.flat());
			updateAttribute(attributes.texture, nextSet.map((_, i) => i));
			scene.geometry.setInstancedCount(nextSet.length);
			nextSet.forEach((sector, i) => {
				const texture = this.textures.get(detail, sector.x, sector.y);
				this.program.uniforms.tIndices.value[i] = texture.colors();
				this.program.uniforms.tTimestamps.value[i] = texture.timestamps();
			});
			this.renderer.render({ scene });
		}
	}

	private renderTemplates(palette: Texture, templates: Template[]) {
		const [width, height] = this.shape.size();
		this.templateProgram.uniforms.tPalette.value = palette;
		this.templateProgram.uniforms.uPaletteSize.value = palette.width;

		const attributes = this.templateMesh.geometry.attributes;

		const parallelism = this.templateProgram.maxParallelism;
		while (templates.length > 0) {
			const nextSet = templates.splice(0, parallelism);
			const offsets = nextSet.map(t => new Vec2(t.x / t.width, t.y / t.height));
			const sizes = nextSet.map(t => new Vec2(width / t.width, height / t.height));
			const indices = nextSet.map((_, i) => i);
			updateAttribute(attributes.offset, offsets);
			updateAttribute(attributes.size, sizes);
			updateAttribute(attributes.texture, indices);
			this.templateMesh.geometry.setInstancedCount(nextSet.length);
			const textures = nextSet.map(t => t.prepare(this.renderer, palette));
			this.templateProgram.uniforms.tTemplate.value = textures;
			this.renderer.render({ scene: this.templateMesh });
		}
	}
}
