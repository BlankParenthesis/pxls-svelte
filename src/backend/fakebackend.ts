import { Shape } from "../shape";
import { Color, Palette } from "../palette";
import type {
	Board,
	Backend,
	BoardChoice,
	BoardInfo,
	BoardUsersInfo,
	Placement,
} from "./backend";

class FakeBoardInfo implements BoardInfo {
	constructor(
		public readonly name: string,
		public readonly shape: Shape,
		public readonly palette: Palette,
		public readonly maxPixelsAvailable: number,
		public readonly createdAt: Date,
	) {}
}

class FakeBoardChoice implements BoardChoice {
	constructor(
		private readonly name: string,
		private readonly shape: Shape,
		private readonly palette: Palette,
	) {}

	info() {
		return Promise.resolve(new FakeBoardInfo(
			this.name,
			this.shape,
			this.palette,
			1,
			new Date(2019, 3, 5, 12, 56, 9, 123),
		));
	}

	async connect() {
		return new FakeBoard(await this.info());
	}
}

export class FakeBackend implements Backend {
	async *availableBoards() {
		await Promise.resolve(1);
		yield new FakeBoardChoice(
			"fake_canvas",
			new Shape([[1, 1], [3, 2], [2, 2], [4, 4]]),
			new Map([
				new Color("White", [255, 255, 255, 255]),
				new Color("Blue", [30, 120, 255, 255]),
				new Color("Red", [255, 120, 180, 255]),
				new Color("Green", [100, 255, 140, 255]),
				// Some shades to view higher indices visually for testing
				new Color("1", [11, 11, 11, 255]),
				new Color("2", [22, 22, 22, 255]),
				new Color("3", [33, 33, 33, 255]),
				new Color("4", [44, 44, 44, 255]),
				new Color("5", [55, 55, 55, 255]),
				new Color("6", [66, 66, 66, 255]),
				new Color("7", [77, 77, 77, 255]),
				new Color("8", [88, 88, 88, 255]),
				new Color("9", [99, 99, 99, 255]),
				new Color("10", [110, 110, 110, 255]),
				new Color("11", [121, 121, 121, 255]),
			].map((e, i) => [i, e])),
		);
	}

	permissions() {
		return Promise.resolve({
			"info": true,
			"boards.list": true,
			"boards.post": true,
			"boards.get": true,
			"boards.patch": true,
			"boards.delete": true,
			"socket.core": true,
			"boards.data.get": true,
			"boards.data.patch": true,
			"boards.users": true,
			"boards.pixels.list": true,
			"boards.pixels.get": true,
			"boards.pixels.post": true,
		});
	}

}

export class FakeBoard implements Board {
	private readonly colorsCache = new Map<number, Uint8Array>();
	private readonly timestampsCache = new Map<number, Uint32Array>();

	constructor(
		private readonly boardinfo: BoardInfo,
	) {}
	info(): Promise<BoardInfo> {
		return Promise.resolve(this.boardinfo);
	}
	users(): Promise<BoardUsersInfo> {
		throw new Error("Method not implemented.");
	}
	pixels(): AsyncGenerator<Placement> {
		throw new Error("Method not implemented.");
	}
	lookup(position: number): Promise<Placement> {
		throw new Error("Method not implemented.");
	}
	place(position: number, color: number): Promise<Placement> {
		throw new Error("Method not implemented.");
	}

	private get sectorSize() {
		const [width, height] = this.boardinfo.shape.sectorSize();
		return width * height;
	}

	private colorSector(position: number): Uint8Array {
		let data = this.colorsCache.get(position);
		if (data === undefined) {
			data = new Uint8Array(this.sectorSize).fill(position);
			this.colorsCache.set(position, data);
		}
		return data;
	}

	private timestampSector(position: number): Uint32Array {
		let data = this.timestampsCache.get(position);
		if (data === undefined) {
			data = new Uint32Array(this.sectorSize).map(() => {
				if(Math.random() < 0.20) {
					return Math.floor(Math.random() * 2850);
				} else {
					return 0;
				}
			});
			this.timestampsCache.set(position, data);
		}
		return data;
	}

	colors(sectorIndices: number[]): Promise<Uint8Array[]> {
		return Promise.resolve(sectorIndices.map(i => this.colorSector(i)));
	}
	timestamps(sectorIndices: number[]): Promise<Uint32Array[]> {
		return Promise.resolve(sectorIndices.map(i => this.timestampSector(i)));
	}
	mask(sectorIndices: number[]): Promise<Uint8Array[]> {
		throw new Error("Method not implemented.");
	}
	initial(sectorIndices: number[]): Promise<Uint8Array[]> {
		throw new Error("Method not implemented.");
	}
}