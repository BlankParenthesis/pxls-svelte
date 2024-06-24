import { z } from "zod";

export const ShapeParser = z.array(z.array(z.number()).length(2)).min(1)
	.transform(s => {
		if (s.length === 0) {
			throw new Error("Degenerate board shape");
		} else if (s.length === 1) {
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

	slice(start?: number, end?: number): Shape {
		return new Shape(this.raw.slice(start, end));
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

	get(level: number) {
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
	 * @returns The array addressing the sector at the given euclidean coordinates.
	 * Here are examples for a shape of `[[2, 2], [2, 2], [_, _]]`.
	 * This Shape produces a board like this:
	 * ```
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 *    □□□□
	 * ```
	 * where `□` represents a sector of size `[_, _]`
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
	 * So, when provided input of `[2, 3]` for a shape of `[[2, 2], [2, 2], [_, _]]`,
	 * this function outputs `[3, 2]`
	 */
	coordinatesToIndexArray(x: number, y: number): number[] {
		const [sectorsX, sectorsY] = this.slice(0, -1).size();
		const [sectionsX, sectionsY] = this.get(0);

		const rangedX = x % sectorsX;
		const rangedY = y % sectorsY;
		
		const subX = Math.floor(sectionsX * rangedX / sectorsX);
		const subY = Math.floor(sectionsY * rangedY / sectorsY);
		const subPosition = subX + (subY * sectionsX);

		if (this.depth > 2) {
			const rest = this.slice(1).coordinatesToIndexArray(x, y);
			return [subPosition].concat(rest);
		} else {
			return [subPosition];
		}
	}

	/**
	 * @returns The real index of a sector based on the addressing array.
	 */
	indexArrayToSector(indexArray: number[]): number {
		return indexArray.reduce((position, index, depth) => {
			const [width, height] = this.slice(depth + 1, -1).size();
			return position + index * width * height;
		}, 0);
	}

	mergeSectors(location: number[]): MergeInstructions {
		const subsection = this.slice(location.length);
		const size = subsection.size();
		const [sectorsX, sectorsY] = subsection.slice(0, -1).size();
		const sectorsCount = sectorsX * sectorsY;

		const sectors = new Array(sectorsCount) as number[];

		for (let x = 0; x < sectorsX; x++) {
			for (let y = 0; y < sectorsY; y++) {
				sectors[x + y * sectorsX] = this.indexArrayToSector(
					location.concat(subsection.coordinatesToIndexArray(x, y)),
				);
			}
		}

		return new MergeInstructions(size, this.sectorSize(), sectors);
	}
}
