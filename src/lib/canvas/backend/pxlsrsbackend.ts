import { Color, type Palette } from "../palette";
import { Shape } from "../shape";
import type { Backend, Board, BoardChoice, BoardInfo, BoardUpdate, BoardUsersInfo, OnEventArguments, Permissions, PixelsAvailable, Placement } from "./backend";
import { CachedBoard } from "./cachedbackend";

interface Reference<T> {
	uri: string;
	view?: T | null;
}

function isReference(reference: unknown): reference is Reference<unknown> {
	return typeof reference === "object"
		&& reference !==  null
		&& "uri" in reference
		&& typeof reference.uri === "string"
		&& (
			!("next" in reference)
			|| typeof reference.next === "string"
			|| reference.next === null
		);
}

interface Page<T> {
	items: Array<T>;
	next?: string | null;
	previous?: string | null;
}

function isPage(page: unknown): page is Page<unknown> {
	return typeof page === "object"
		&& page !==  null
		&& "items" in page
		&& Array.isArray(page.items)
		&& (
			!("next" in page)
			|| typeof page.next === "string"
			|| page.next === null
		);
}

class PxlsRsBoardChoice implements BoardChoice {
	constructor(
		private location: URL,
		private cachedInfo: BoardInfo | null,
	) {}
	
	async connect(): Promise<Board> {
		return await PxlsRsBoard.connect(this.location);
	}
	
	async info(): Promise<BoardInfo> {
		if (this.cachedInfo === null) {
			this.cachedInfo = await PxlsRsBoardInfo.fetch(this.location);
		}

		return this.cachedInfo;
	}
}

export class PxlsRsBackend implements Backend {
	constructor(
		private readonly site: URL,
	) {}

	async *availableBoards() {
		let url: URL | null = new URL("/boards", this.site);
		do {
			const boards = await fetch(url).then(d => d.json()) as unknown;

			if (!isPage(boards)) {
				throw new Error("malformed boards list");
			}
			for (const board of boards.items) {
				if (!isReference(board)) {
					throw new Error("malformed reference in boards list");
				}
				
				const location = new URL(board.uri, url);
				let info = null;
				if (board.view) {
					if (!PxlsRsBoardInfo.isInfoValid(board.view)) {
						throw new Error("malformed reference view in boards list");
					}
					info = new PxlsRsBoardInfo(board.view);
				}
				yield new PxlsRsBoardChoice(location, info);
			}

			if (typeof boards.next === "string") {
				url = new URL(boards.next);
			} else {
				url = null;
			}
		} while(url);
	}

	async permissions(): Promise<Permissions> {
		throw new Error("Method not implemented.");
	}

}

interface PxlsRsInfo {
	name: string,
	shape: Array<[number, number]>,
	palette: Map<number, { name: string, value: number }>,
	max_pixels_available: number,
	created_at: Date,
}

class PxlsRsBoardInfo implements BoardInfo {
	readonly name: string;
	readonly shape: Shape;
	readonly palette: Palette;
	readonly maxPixelsAvailable: number;
	readonly createdAt: Date;

	constructor(info: PxlsRsInfo) {
		this.name = info.name;
		if (info.shape.length === 1)  {
			this.shape = new Shape([[1, 1] as [number, number]].concat(info.shape));
		} else {
			this.shape = new Shape(info.shape);
		}
		this.palette = new Map(Object.entries(info.palette)
			.map(([i, c])  => {
				const index = parseInt(i);
				const color = Color.fromNumber(c.name, c.value);
				return [index, color];
			}));
		this.maxPixelsAvailable = info.max_pixels_available;
		this.createdAt = info.created_at;

	}

	static isInfoValid(info: unknown): info is PxlsRsInfo {
		if (typeof info === "object" && info !== null) {
			// This isn't the most bulletproof type assertion, but parsing in TS
			// is a huge pain.
			// I miss Serde 😭.
			const anyInfo = info as { [prop: string]: unknown };

			return (typeof anyInfo.name === "string")
				&& (typeof anyInfo.max_pixels_available === "number")
				&& (typeof anyInfo.created_at === "number")
				&& Array.isArray(anyInfo.shape)
				&& anyInfo.shape.every(set => {
					return Array.isArray(set)
						&& set.every(dim => typeof dim === "number")
						// NOTE: this is not a spec requirement, but is a
						// limitation of this implementation.
						&& set.length === 2;
				})
				&& typeof anyInfo.palette === "object"
				&& anyInfo.palette !== null
				&& Object.keys(anyInfo.palette).every(key => !isNaN(parseInt(key)))
				&& Object.values(anyInfo.palette).every(color => {
					const anyColor = color as { [prop: string]: unknown };
					return typeof anyColor.name === "string"
						&& typeof anyColor.value === "number";
				});
		} else {
			return false;
		}
	}

	static async fetch(boardLocation: URL): Promise<BoardInfo> {
		const info = await fetch(boardLocation).then(d => d.json()) as unknown;

		if (PxlsRsBoardInfo.isInfoValid(info)) {
			return new PxlsRsBoardInfo(info);
		} else {
			throw new Error("board info malformed");
		}
	}
}

class PxlsRsBoard extends CachedBoard {
	private listeners = {
		"board_update": [] as Array<(data: BoardUpdate) => void>,
		"pixels_available": [] as Array<(data: PixelsAvailable) => void>,
	};

	public static async connect(location: URL): Promise<PxlsRsBoard> {
		const events = [
			"data.colors",
			"data.timestamps",
		];
		const query = events
			.map(e => "subscribe[]=" + encodeURIComponent(e))
			.join("&");
		const socketUrl = new URL("events?" + query, location.href + "/");
		const socket = new WebSocket(socketUrl);
		await new Promise((resolve, reject) => {
			socket.onopen = resolve;
			socket.onerror = reject;
		});
		return new PxlsRsBoard(location, socket);
	}

	private constructor(
		readonly location: URL,
		private readonly socket: WebSocket,
	) {
		super();
		this.on("board_update", (u: BoardUpdate) => this.update(u));
		socket.addEventListener("message", e => {
			const packet = JSON.parse(e.data);
			switch (packet.type) {
				case "board-update": 
					this.listeners.board_update.forEach(l => l(packet));
					break;
				case "pixels-available": 
					this.listeners.pixels_available.forEach(l => l(packet));
					break;
			}
		});
	}

	on(...args: OnEventArguments) {
		const [event, callback] = args;
		switch (event) {
			case "pixels_available":
				this.listeners.pixels_available.push(callback);
				break;
			case "board_update":
				this.listeners.board_update.push(callback);
				break;
		}
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
		return PxlsRsBoardInfo.fetch(this.location);
	}

	private async sectorRange(sector: number, multiplier = 1): Promise<string> {
		const info = await this.info();
		const [width, height] = info.shape.sectorSize();
		const sectorSize = width * height * multiplier;
		const sectorStart = sectorSize * sector;
		const sectorEnd = sectorStart + sectorSize;
		return "bytes=" + sectorStart + "-" + sectorEnd;
	}

	protected async fetchColors(sector: number): Promise<Uint8Array> {
		const url = new URL("data/colors", this.location.href + "/");
		const headers = { "Range": await this.sectorRange(sector)};
		return await fetch(url, { headers })
			.then(response => response.arrayBuffer())
			.then(bytes => new Uint8Array(bytes));
	}
	
	protected async fetchTimestamps(sector: number): Promise<Uint32Array> {
		const url = new URL("data/timestamps", this.location + "/");
		const headers = { "Range": await this.sectorRange(sector, 4)};
		return await fetch(url, { headers })
			.then(response => response.arrayBuffer())
			.then(bytes => new Uint32Array(bytes));
	}
	protected async fetchMask(sector: number): Promise<Uint8Array> {
		const url = new URL("data/mask", this.location + "/");
		const headers = { "Range": await this.sectorRange(sector)};
		return await fetch(url, { headers })
			.then(response => response.arrayBuffer())
			.then(bytes => new Uint8Array(bytes));
	}
	protected async fetchInitial(sector: number): Promise<Uint8Array> {
		const url = new URL("data/initial", this.location + "/");
		const headers = { "Range": await this.sectorRange(sector)};
		return await fetch(url, { headers })
			.then(response => response.arrayBuffer())
			.then(bytes => new Uint8Array(bytes));
	}
}