import { Texture, Vec2, Renderer, Mesh, Mat3, Program } from "ogl";
import type { Board } from "../board/board";
import { QuadQuad } from "./gl";
import { Palette, toTexture } from "../board/palette";
import { Shape } from "./shape";
import { Template } from "./template";
import { CanvasTextures } from "./canvastextures";
import { nextFrame, ratio, updateAttribute, type Instanceable } from "../util";
import { type RendererOverrides } from "../settings";
import { TemplateProgram } from "./program/template";
import { CanvasProgram } from "./program/canvas";
import { DebugProgram } from "./program/debug";

export class ViewBox {
	readonly bottom: number;
	readonly left: number;
	readonly top: number;
	readonly right: number;
	constructor(view: {
		bottom: number,
		left: number,
		top: number,
		right: number,
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
};

export type RenderParameters = {
	transform: Mat3;
	templates: Template[];
	timestampStart: number;
	timestampEnd: number;
	heatmapDim: number;
}

export class Canvas {
	private palette: Texture;
	private readonly renderer: Renderer;
	private readonly program: CanvasProgram;
	private readonly debugProgram: DebugProgram;
	private readonly templateProgram: TemplateProgram;
	private mesh: Mesh<QuadQuad, CanvasProgram>;
	private debugMesh: Mesh<QuadQuad, DebugProgram>;
	private templateMesh: Mesh<QuadQuad, TemplateProgram>;
	private textures: CanvasTextures;

	get gl() {
		return this.renderer.gl;
	}

	constructor(
		board: Board,
		private shape: Shape,
		palette: Palette,
		canvas: HTMLCanvasElement,
	) {
		this.renderer = new Renderer({
			canvas,
			autoClear: false,
			depth: false,
		});
		const gl = this.gl;

		this.palette = toTexture(gl, palette);

		gl.clearColor(0, 0, 0, 1);

		this.textures = new CanvasTextures(gl, board, shape);
		this.program = new CanvasProgram(gl);
		this.debugProgram = new DebugProgram(gl);
		this.templateProgram = new TemplateProgram(gl);

		const geometry = new QuadQuad(gl);
		this.mesh = new Mesh(this.gl, { geometry, program: this.program });
		this.debugMesh = new Mesh(this.gl, { geometry, program: this.debugProgram });
		this.templateMesh = new Mesh(this.gl, { geometry, program: this.templateProgram });
	}

	setSize(newWidth: number, newHeight: number) {
		if (this.gl.canvas.width !== newWidth || this.gl.canvas.height !== newHeight) {
			// FIXME: this causes flicker? probably has to recreate view
			this.renderer.setSize(newWidth, newHeight);
			const screenScale = ratio(newWidth, newHeight);
			const boardScale = ratio(...this.shape.size());
			const scale = screenScale.multiply(boardScale);
			this.program.uniforms.uAspect.value = scale;
			this.debugProgram.uniforms.uAspect.value = scale;
			this.templateProgram.uniforms.uAspect.value = scale;
		}
	}

	/** 
	 * @returns The viewbox relative to the top left of the unit board.
	 */
	visibleArea(): ViewBox {
		const inverse = new Mat3(...this.program.uniforms.uView.value)
			.multiply(new Mat3().identity().scale(this.program.uniforms.uAspect.value))
			.inverse();
		
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
		overrides: RendererOverrides,
	) {
		this.program.uniforms.uTimestampRange.value = new Vec2(parameters.timestampStart, parameters.timestampEnd);
		this.program.uniforms.uHeatmapDim.value = 1 - parameters.heatmapDim;
		this.program.uniforms.tPalette.value = palette;
		this.program.uniforms.uPaletteSize.value = palette.width;
		this.templateProgram.uniforms.uHeatmapDim.value = 1 - parameters.heatmapDim;

		this.debugProgram.uniforms.uOutline.value = overrides.debugOutline;
		this.debugProgram.uniforms.uOutlineStripe.value = overrides.debugOutlineStripe;

		const view = new Mat3(...parameters.transform);
		this.program.uniforms.uView.value = view;
		this.debugProgram.uniforms.uView.value = view;
		this.templateProgram.uniforms.uView.value = view;

		const [width, height] = this.shape.size();
		this.templateProgram.uniforms.uBoardSize.value = new Vec2(width, height);
	}

	async render(parameters: RenderParameters, overrides: RendererOverrides) {
		const palette = await this.palette;

		if (!overrides.zoom) {
			const scale = new Vec2(parameters.transform[0], parameters.transform[4]);
			const [minZoomX, minZoomY] = this.shape.slice(0, -1).slice(0, 1).size().map(v => v * 2);
			const correctionX = minZoomX / scale.x;
			const correctionY = minZoomY / scale.y;
			const correction = Math.max(correctionX, correctionY);
			if (correction > 1) {
				parameters.transform.scale(new Vec2(correction, correction));
			}
		}

		this.updateUniforms(palette, parameters, overrides);

		type Scene = Mesh<QuadQuad, Program & Instanceable>;
		const scene = (overrides.debug ? this.debugMesh : this.mesh);
		const visible = this.visibleArea();

		let detail: number;
		if (typeof overrides.detailLevel === "undefined") {
			detail = this.detailLevel(visible);
		} else {
			detail = overrides.detailLevel;
		}
		detail = Math.max(1, Math.min(detail, this.shape.depth - 1));

		const [width, height] = this.shape.slice(0, detail).size();
		updateAttribute(
			scene.geometry.attributes.size,
			Array(scene.program.maxParallelism).fill(new Vec2(width, height)),
		);
		
		const sectors = this.visibleSectors(visible, detail);
		if (typeof overrides.detailLevel === "undefined") {
			console.assert(sectors.length <= 4, "More than 4 sectors were visible");
		} else if (!overrides.debug) {
			sectors.splice(4);
		}
		await this.renderSectors(scene as Scene, sectors, detail);
		this.renderTemplates(palette, [...parameters.templates]);
		this.textures.prune();
	}

	private async renderSectors<P extends Program & Instanceable>(
		scene: Mesh<QuadQuad, P>,
		sectors: Array<Vec2>,
		detail: number,
	) {
		// TODO: this was a bad idea, sort rendering flow out once and for all.
		// (probably by removing the frame await in the render call, but there's more to it than that)
		const frame = new Promise(resolve => nextFrame().then(resolve))
			.then(() => this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT));
		
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
			await frame; // this only waits once
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
			updateAttribute(attributes.offset, nextSet.map(t => new Vec2(t.x / t.image.width, t.y / t.image.height)));
			updateAttribute(attributes.size, nextSet.map(t => new Vec2(width / t.image.width, height / t.image.height)));
			updateAttribute(attributes.texture, nextSet.map((_, i) => i));
			this.templateMesh.geometry.setInstancedCount(nextSet.length);
			this.templateProgram.uniforms.tTemplate.value = nextSet.map(t => t.image);
			this.renderer.render({ scene: this.templateMesh });
		}
	}
}