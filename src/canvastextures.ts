// A note on this file:
// It would probably be more relevant in the canvas.ts module but I wanted some
// space to clear my thoughts on it, so here it goes for now.

import { OGLRenderingContext, Texture } from "ogl-typescript";
import type { Board } from "./backend/backend";
import type { MergeInstructions, Shape } from "./shape";

class SectorTextures {
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
	) {}

	private newTexture8(): Texture {
		return new Texture(this.gl, {
			image: new Uint8Array(1),
			width: 1,
			height: 1,
			minFilter: this.gl.NEAREST,
			magFilter: this.gl.NEAREST,
			format: this.gl.LUMINANCE,
			internalFormat: this.gl.LUMINANCE,
		});
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

	colors(): Texture {
		if (this.colorsCached === undefined) {
			const gl = this.gl;
			const texture = this.colorsCached = this.newTexture8();
			const width = this.width;
			const height = this.height;
			const instructions = this.sectorCreationInstructions;
			this.board.colors(instructions.positions)
				.then(colors => {
					texture.image = instructions.merge(colors);
					texture.width = width;
					texture.height = height;
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
					texture.update();
					gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
				})
				.catch(console.error);
		}

		return this.colorsCached;
	}

	timestamps(): Texture {
		if (this.timestampsCached === undefined) {
			this.timestampsCached = this.newTexture32();
		}

		return this.timestampsCached;
	}

	mask(): Texture {
		if (this.maskCached === undefined) {
			this.maskCached = this.newTexture8();
		}

		return this.maskCached;
	}

	initial(): Texture {
		if (this.initialCached === undefined) {
			this.initialCached = this.newTexture8();
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
	) {
		this.cache = new Array(shape.depth)
			.fill(null)
			.map(() => new Map<number, SectorTextures>());
	}

	get(
		detailLevel: number,
		x: number,
		y: number,
	): SectorTextures | null {
		const [maxX, maxY] = this.shape.slice(0, detailLevel + 1).size();
		if ((0 <= x && x < maxX) && (0 <= y && y < maxY)) {
			const sectorPosition = x * maxX + y;
			
			let sector = this.cache[detailLevel].get(sectorPosition);
			if (sector === undefined) {
				const [width, height] = this.shape.slice(detailLevel + 1).size();
				const slicedShape = this.shape.slice(0, detailLevel + 2);
				const arrayIndex = slicedShape.coordinatesToIndexArray(x, y);

				sector = new SectorTextures(
					this.gl,
					this.board,
					this.shape.mergeSectors(arrayIndex),
					width,
					height,
				);

				this.cache[detailLevel].set(sectorPosition, sector);
			}
			return sector;
		} else {
			return null;
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
