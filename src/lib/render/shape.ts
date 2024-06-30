import { z } from "zod";

export const ShapeParser = z.array(z.array(z.number()).length(2)).min(1)
	.transform(s => {
		if (s.length === 0) {
			throw new Error("Degenerate board shape");
		} else if (s.length === 1) {
			console.warn("Server gave an invalid shape");
			return new Shape([[1,1], s[0] as [number, number]]);
		} else {
			return new Shape(s as Array<[number, number]>);
		}
	});

export class MergeInstructions {
	constructor(
		/**
		 * The total size expected of the merged buffer
		 */
		private readonly size: [number, number],
		private readonly sectorSize: [number, number],
		/**
		 * The sectors to merge, in order.
		 */
		readonly positions: number[],
	) {}

	merge(sectors: Uint8Array[] | Uint32Array[]): Uint8Array {
		const bytesPer = sectors[0].BYTES_PER_ELEMENT;
		const is8 = bytesPer === 1;

		const width = bytesPer * this.size[0];
		const height = this.size[1];
		const buffer = new Uint8Array(width * height);
		
		const sectorWidth = bytesPer * this.sectorSize[0];
		const sectorHeight = this.sectorSize[1];
		const sectorSize = sectorWidth * sectorHeight;
		const sectorsX = width / sectorWidth;
		
		const firstSector = this.positions[0];
		
		const sectors8 = is8 ?
			(sectors as Uint8Array[]) :
			(sectors as Uint32Array[]).map(s => new Uint8Array(s.buffer));

		for (let position = 0; position < sectors.length; position++) {
			const relativePosition = this.positions[position] - firstSector;
			const x = relativePosition % sectorsX;
			const y = Math.floor(relativePosition / sectorsX);
			const start = x * sectorWidth + y * sectorSize * sectorsX;
			const sector = sectors8[relativePosition];
			
			for (let y = 0; y < sectorHeight; y++) {
				const sliceStart = y * sectorWidth;
				buffer.set(
					sector.slice(sliceStart, sliceStart + sectorWidth),
					start + y * width,
				);
			}
		}

		return buffer;
	}
}

export class Shape {
	readonly depth;
	// positionMap[depth][flatPosition] = shapedPosition
	//private readonly positionMap: number[][];

	constructor(
		private readonly raw: Array<[number, number]>,
	) {
		this.depth = raw.length;
	}

	toString(): string {
		const items = this.raw.map(i => `[${i.join(", ")}]`);
		return `[${items.join(", ")}]`;
	}

	slice(start?: number, end?: number): Shape {
		return new Shape(this.raw.slice(start, end));
	}

	/**
	 * A special case of slice which removes the last element
	 */
	sectors(): Shape {
		return this.slice(0, -1);
	}

	size(): [number, number] {
		return this.raw.reduce(
			([width, height], [x, y]) => [width * x, height * y],
			[1, 1],
		);
	}

	sectorSize(): [number, number] {
		return this.get(this.depth - 1);
	}

	get(level: number): [number, number] {
		if (!(level in this.raw)) {
			throw new Error("shape is not deep enough");
		}
		return this.raw[level];
	}

	/**
	 * @param position absolute pixel position 
	 * @returns [sector index, sector offset]
	 */
	positionToSector(position: number): [number, number] {
		const [width, height] = this.sectorSize();
		const sectorLength = width * height;
		const sectorIndex = Math.floor(position / sectorLength);
		const sectorOffset = position % sectorLength;
		return [sectorIndex, sectorOffset];
	}

	/**
	 * @param x the x coordinate of the position in the shape.
	 * @param y the y coordinate of the position in the shape.
	 * @returns The array addressing the sector at the given euclidean coordinates.
	 * Here are examples for a shape of `[[2, 2], [2, 2]]`.
	 * This Shape produces a board like this:
	 * ```
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 * ```
	 * where `□` represents a unit which may be:
	 * - a pixel if the shape is unsliced
	 * - a sector if the last component is removed (for example with `sectors()`)
	 * Sectors are logically ordered like this:
	 * ```
	 *    0  1  4  5
	 *    2  3  6  7
	 *    8  9  12 13
	 *    10 11 14 15
	 * ```
	 * The addressing array `[0, 0]` references the first sector in the first quadrant:
	 * ```
	 *    ■□□□
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 * ```
	 * Then addressing array `[0, 1]` references the second sector in the first quadrant:
	 * ```
	 *    □■□□
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 * ```
	 * And addressing array `[0, 2]` references the third sector in the first quadrant:
	 * ```
	 *    □□□□
	 *    ■□□□
	 *    □□□□
	 *    □□□□
	 * ```
	 * This sectors can also be referenced by their Euclidean position.
	 * For example, this sector is at position (2, 3):
	 * ```
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 *    □□■□
	 * ```
	 * The addressing array for position (2, 3) is [3, 2] (fourth quadrant, third sector).
	 * So, when provided input of `[2, 3]` for a shape of `[[2, 2], [2, 2]]`,
	 * this function outputs `[3, 2]`
	 */
	coordinatesToIndexArray(x: number, y: number): number[] {
		if (this.depth === 0) {
			return [];
		} else {
			const subsection = this.slice(1);
			const [subsectionWidth, subsectionHeight] = subsection.size();
			const [sectionWidth, _] = this.slice(0, 1).size();
			const subsectionX = Math.floor(x / subsectionWidth);
			const subsectionY = Math.floor(y / subsectionHeight);
			const subPosition = subsectionX + (subsectionY * sectionWidth);
			const rest = subsection.coordinatesToIndexArray(
				x % subsectionWidth,
				y  % subsectionHeight,
			);
						
			return [subPosition].concat(rest);
		}
	}

	/**
	 * @returns The real index of a sector based on the addressing array.
	 */
	indexArrayToPosition(indexArray: number[]): number {
		return indexArray.reduce((position, index, depth) => {
			const [width, height] = this.slice(depth + 1).size();
			return position + index * width * height;
		}, 0);
	}

	mergeSectors(location: number[]): MergeInstructions {
		const subsection = this.slice(location.length);
		const size = subsection.size();
		const subsectionSectors = subsection.sectors();
		const [sectorsX, sectorsY] = subsectionSectors.size();
		const sectorsCount = sectorsX * sectorsY;

		const sectors = new Array(sectorsCount) as number[];

		for (let x = 0; x < sectorsX; x++) {
			for (let y = 0; y < sectorsY; y++) {
				const subIndexArray = subsectionSectors.coordinatesToIndexArray(x, y);
				const indexArray = location.concat(subIndexArray);
				const sector = this.sectors().indexArrayToPosition(indexArray);
				sectors[x + y * sectorsX] = sector;
			}
		}

		return new MergeInstructions(size, this.sectorSize(), sectors);
	}
}
