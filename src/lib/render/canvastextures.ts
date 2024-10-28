// A note on this file:
// It would probably be more relevant in the canvas.ts module but I wanted some
// space to clear my thoughts on it, so here it goes for now.

import { type OGLRenderingContext, Texture } from "ogl";
import type { Board } from "../board/board";
import type { MergeInstructions, Shape } from "./shape";
import type { Change } from "../board/events";

class SectorTextures {
	private colorsRebuild = false;
	private timestampsRebuild = false;
	private maskRebuild = false;
	private initialRebuild = false;

	private colorsCached: Texture | undefined;
	private timestampsCached: Texture | undefined;
	private maskCached: Texture | undefined;
	private initialCached: Texture | undefined;

	constructor(
		private readonly gl: OGLRenderingContext,
		private readonly board: Board,
		private readonly sectorCreationInstructions: MergeInstructions,
		private readonly width: number,
		private readonly height: number,
		private readonly onload = () => {},
	) {}

	private newTexture8(): Texture {
		this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
		const texture = new Texture(this.gl, {
			image: new Uint8Array(1),
			width: 1,
			height: 1,
			minFilter: this.gl.NEAREST,
			magFilter: this.gl.NEAREST,
			format: this.gl.LUMINANCE,
			internalFormat: this.gl.LUMINANCE,
		});
		this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
		return texture;
	}

	private newTexture32(): Texture {
		return new Texture(this.gl, {
			image: new Uint8Array(4),
			width: 1,
			height: 1,
			minFilter: this.gl.NEAREST,
			magFilter: this.gl.NEAREST,
			format: this.gl.RGBA,
			internalFormat: this.gl.RGBA,
		});
	}

	private lazyMerge(texture: Texture, data: Promise<Uint8Array[] | Uint32Array[]>) {
		const gl = this.gl;
		const width = this.width;
		const height = this.height;
		const instructions = this.sectorCreationInstructions;

		data.then(data => {
			const size = data[0].BYTES_PER_ELEMENT;
			texture.image = instructions.merge(data);
			texture.width = width;
			texture.height = height;
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, size);
			texture.update();
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
			this.onload();
		}).catch(console.error);
	}

	invalidateColors() {
		this.colorsRebuild = true;
	}

	colors(): Texture {
		if(this.colorsRebuild || this.colorsCached === undefined) {
			const instructions = this.sectorCreationInstructions;
			const sectors = instructions.positions.map(i => this.board.colors(i));

			if (this.colorsCached === undefined) {
				this.colorsCached = this.newTexture8();
			}
			
			this.lazyMerge(this.colorsCached, Promise.all(sectors));

			this.colorsRebuild = false;
		}

		return this.colorsCached;
	}

	invalidateTimestamps() {
		this.timestampsRebuild = true;
	}

	timestamps(): Texture {
		if(this.timestampsRebuild || this.timestampsCached === undefined) {
			const instructions = this.sectorCreationInstructions;
			const sectors = instructions.positions.map(i => this.board.timestamps(i));

			if (this.timestampsCached === undefined) {
				this.timestampsCached = this.newTexture32();
			}

			this.lazyMerge(this.timestampsCached, Promise.all(sectors));

			this.timestampsRebuild = false;
		}

		return this.timestampsCached;
	}

	invalidateMask() {
		this.maskRebuild = true;
	}

	mask(): Texture {
		if(this.maskRebuild || this.maskCached === undefined) {
			const instructions = this.sectorCreationInstructions;
			const sectors = instructions.positions.map(i => this.board.mask(i));

			if (this.maskCached === undefined) {
				this.maskCached = this.newTexture8();
			}

			this.lazyMerge(this.maskCached, Promise.all(sectors));

			this.maskRebuild = false;
		}

		return this.maskCached;
	}

	invalidateInitial() {
		this.initialRebuild = true;
	}

	initial(): Texture | null {
		if(this.initialRebuild || this.initialCached === undefined) {
			const instructions = this.sectorCreationInstructions;
			const sectors = instructions.positions.map(i => this.board.initial(i));

			if (this.initialCached === undefined) {
				this.initialCached = this.newTexture8();
			}

			this.lazyMerge(this.initialCached, Promise.all(sectors));

			this.initialRebuild = false;
		}

		return this.initialCached;
	}
}

export class CanvasTextures {
	private cache: Map<number, SectorTextures>[];

	constructor(
		private gl: OGLRenderingContext,
		private board: Board,
		private shape: Shape,
		private readonly onupdate = () => {},
	) {
		this.cache = new Array(shape.depth).fill(null).map(() => new Map());
		// make each [1, 1] shape level map to the level above
		Array(shape.depth - 1)
			.fill(null)
			.map((_, i) => i + 1)
			.filter(i => shape.get(i).every(v => v === 1))
			.forEach(i => this.cache[i] = this.cache[i -1]);

		board.onUpdate(update => {
			update.data?.colors?.forEach(c => this.updateColors(c));
			update.data?.timestamps?.forEach(c => this.updateTimestamps(c));
			update.data?.mask?.forEach(c => this.updateMask(c));
			update.data?.initial?.forEach(c => this.updateInitial(c));
			this.onupdate();
		});
	}

	get(
		detailLevel: number,
		x: number,
		y: number,
	): SectorTextures {
		const [maxX, maxY] = this.shape.slice(0, detailLevel).size();
		if (x < 0 || x >= maxX || y < 0 || y >= maxY) {
			throw new Error(`No data at ${x}, ${y} for detail level ${detailLevel}`);
		}
		
		const sectorPosition = y * maxX + x;

		let sector = this.cache[detailLevel].get(sectorPosition);
		if (sector === undefined) {
			const [width, height] = this.shape.slice(detailLevel).size();
			const subsectorShape = this.shape.slice(0, detailLevel + 1);
			const arrayIndex = subsectorShape.sectors().coordinatesToIndexArray(x, y);

			sector = new SectorTextures(
				this.gl,
				this.board,
				this.shape.mergeSectors(arrayIndex),
				width,
				height,
				this.onupdate,
			);

			this.cache[detailLevel].set(sectorPosition, sector);
		}
		return sector;
	}

	private *invalidatedTextures(change: Change) {
		for (const [detailLevel, cached] of this.cache.entries()) {
			const [width, height] = this.shape.slice(detailLevel).size();
			const index = Math.floor(change.position / (width * height)); 
			const textures = cached.get(index);
			if (textures !== undefined) {
				yield textures;
			}
		}
	}

	updateColors(change: Change) {
		for (const textures of this.invalidatedTextures(change)) {
			textures.invalidateColors();
		}
	}

	updateTimestamps(change: Change) {
		for (const textures of this.invalidatedTextures(change)) {
			textures.invalidateTimestamps();
		}
	}

	updateMask(change: Change) {
		for (const textures of this.invalidatedTextures(change)) {
			textures.invalidateMask();
		}
	}

	updateInitial(change: Change) {
		for (const textures of this.invalidatedTextures(change)) {
			textures.invalidateInitial();
		}
	}

	private last = 0;
	prune() {
		// TODO: evict old buffers/textures to save memory
		const textures = this.cache.reduce((count, map) => count + map.size, 0);
		if (textures !== this.last) {
			console.debug(`${textures} textures loaded`);
			this.last = textures;
		}
	}
}
