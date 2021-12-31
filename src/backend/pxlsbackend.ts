import { Color, Palette } from "../palette";
import { Shape } from "../shape";
import type { Backend, Board, BoardChoice, BoardInfo, BoardUsersInfo, Permissons, Placement } from "./backend";
import { CachedBoard } from "./cachedbackend";

interface PxlsInfo {
	canvasCode: string;
	width: number;
	height: number;
	maxStacked: number;
	palette: Array<{
		name: string;
		value: string;
	}>;
	heatmapCooldown: number;
}

class PxlsBoardInfo implements BoardInfo {
	private constructor(
		readonly name: string,
		readonly shape: Shape,
		readonly palette: Palette,
		readonly maxPixelsAvailable: number,
		/**
		 * Time in seconds.
		 */
		readonly heatmapCooldown: number,
	) {}

	get createdAt() {
		return null;
	}

	private static isInfoValid(info: unknown): info is PxlsInfo {
		if (typeof info === "object" && info !== null) {
			// This isn't the most bulletproof type assertion, but parsing in TS
			// is a huge pain.
			// I miss Serde 😭.
			const anyInfo = info as { [prop: string]: unknown };

			return (typeof anyInfo.canvasCode === "string")
				&& (typeof anyInfo.width === "number")
				&& (typeof anyInfo.height === "number")
				&& (typeof anyInfo.maxStacked === "number")
				&& (typeof anyInfo.heatmapCooldown === "number")
				&& Array.isArray(anyInfo.palette)
				&& anyInfo.palette.every(color => {
					const anyColor = color as { [prop: string]: unknown };
					return typeof anyColor.name === "string"
						&& typeof anyColor.value === "string";
				});
		} else {
			return false;
		}
	}

	static async fetch(site: URL): Promise<BoardInfo> {
		const location = new URL("info", site).toString();
		const info = await (await fetch(location)).json() as unknown;

		if (PxlsBoardInfo.isInfoValid(info)) {
			return new PxlsBoardInfo(
				info.canvasCode,
				new Shape([[1, 1], [info.width, info.height]]),
				new Map(info.palette.map(c => Color.fromHex(c.name, c.value)).entries()) as Palette,
				info.maxStacked,
				info.heatmapCooldown,
			);
		} else {
			throw new Error("Pxls /info malformed");
		}
	}
}

class PxlsBoardChoice implements BoardChoice {
	private infoCache?: Promise<BoardInfo>;

	constructor(
		private readonly site: URL,
	) {}

	connect(): Promise<Board> {
		return Promise.resolve(new PxlsBoard(this.site) as Board);
	}

	info(): Promise<BoardInfo> {
		if(this.infoCache === undefined) {
			this.infoCache = PxlsBoardInfo.fetch(this.site);
		}

		return this.infoCache;
	}
}

export class PxlsBackend implements Backend {
	constructor(
		private readonly site: URL,
	) {}

	async *availableBoards() {
		yield new PxlsBoardChoice(this.site);
	}

	permissions(): Promise<Permissons> {
		throw new Error("Method not implemented.");
	}
}

class PxlsBoard extends CachedBoard {
	constructor(
		private site: URL,
	) {
		super();
	}

	users(): Promise<BoardUsersInfo> {
		throw new Error("Method not implemented.");
	}
	pixels(): AsyncGenerator<Placement> {
		throw new Error("Method not implemented.");
	}
	lookup(position: number): Promise<Placement | null> {
		throw new Error("Method not implemented.");
	}
	place(position: number, color: number): Promise<Placement> {
		throw new Error("Method not implemented.");
	}

	protected fetchInfo(): Promise<BoardInfo> {
		return PxlsBoardInfo.fetch(this.site);
	}

	protected async fetchColors(sector: number): Promise<Uint8Array> {
		if (sector !== 0) {
			throw new Error("Sector index should be 0");
		}

		const location = new URL("boarddata", this.site).toString();
		const blob = await (await fetch(location)).blob();
		const buffer = new Uint8Array(await blob.arrayBuffer());
		// TODO: check size is correct
		return buffer;
	}

	protected async fetchTimestamps(sector: number): Promise<Uint32Array> {
		if (sector !== 0) {
			throw new Error("Sector index should be 0");
		}

		const location = new URL("heatmap", this.site).toString();
		const blob = await (await fetch(location)).blob();
		const raw = Uint32Array.from(new Uint8Array(await blob.arrayBuffer()));
		const { heatmapCooldown } = await this.info() as PxlsBoardInfo;
		// TODO: check size is correct
		const currentTime = Math.floor(Date.now() / 1000);

		const buffer = raw.map(v => {
			if (v === 0) {
				// TODO: return 0 or 1 based on virginmap;
				return 0;
			} else {
				return currentTime - ((255 - v) * (heatmapCooldown / 255));
			}
		});

		return buffer;
	}

	protected async fetchMask(sector: number): Promise<Uint8Array> {
		throw new Error("Method not implemented.");
	}

	protected async fetchInitial(sector: number): Promise<Uint8Array> {
		throw new Error("Method not implemented.");
	}
}