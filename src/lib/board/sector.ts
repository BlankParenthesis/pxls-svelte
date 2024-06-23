import type { Requester } from "../requester";
import { BoardInfo } from "./info";

function sectorRange(info: BoardInfo, sector: number, multiplier = 1): [number, number] {
	const [width, height] = info.shape.sectorSize();
	const sectorSize = width * height * multiplier;
	const sectorStart = sectorSize * sector;
	const sectorEnd = sectorStart + sectorSize;
	return [sectorStart, sectorEnd];
}

export class DataCache {
	private data = new Map<number, Promise<Uint8Array>>();

	constructor(
		private readonly http: Requester,
	) {}

	get(info: BoardInfo, sector: number): Promise<Uint8Array> {
		if (!this.data.has(sector)) {
			const [start, end] = sectorRange(info, sector);
			const promise = this.http.data(start, end)
				.then(bytes => new Uint8Array(bytes));

			this.data.set(sector, promise);
		}

		return this.data.get(sector) as unknown as Promise<Uint8Array>;
	}

	invalidate(sector: number) {
		this.data.delete(sector);
	}
}

export class DataCache32 {
	private data = new Map<number, Promise<Uint32Array>>();

	constructor(
		private readonly http: Requester,
	) {}

	get(info: BoardInfo, sector: number): Promise<Uint32Array> {
		if (!this.data.has(sector)) {
			const [start, end] = sectorRange(info, sector, 4);
			const promise = this.http.data(start, end)
				.then(bytes => new Uint32Array(bytes));

			this.data.set(sector, promise);
		}

		return this.data.get(sector) as unknown as Promise<Uint32Array>;
	}
}