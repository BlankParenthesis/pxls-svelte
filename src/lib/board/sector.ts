import { BoardInfo } from "./info";

function sectorRange(info: BoardInfo, sector: number, multiplier = 1): string {
	const [width, height] = info.shape.sectorSize();
	const sectorSize = width * height * multiplier;
	const sectorStart = sectorSize * sector;
	const sectorEnd = sectorStart + sectorSize;
	return "bytes=" + sectorStart + "-" + sectorEnd;
}

export class DataCache {
	private data = new Map<number, Promise<Uint8Array>>();

	constructor(
		private readonly location: URL,
	) {}

	get(info: BoardInfo, sector: number): Promise<Uint8Array> {
		if (!this.data.has(sector)) {
			const range = sectorRange(info, sector);
			const headers = { "Range":  range };
			const promise = fetch(this.location, { headers })
				.then(response => response.arrayBuffer())
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
		private readonly location: URL,
	) {}

	get(info: BoardInfo, sector: number): Promise<Uint32Array> {
		if (!this.data.has(sector)) {
			const range = sectorRange(info, sector, 4);
			const headers = { "Range":  range };
			const promise = fetch(this.location, { headers })
				.then(response => response.arrayBuffer())
				.then(bytes => new Uint32Array(bytes));

			this.data.set(sector, promise);
		}

		return this.data.get(sector) as unknown as Promise<Uint32Array>;
	}
}