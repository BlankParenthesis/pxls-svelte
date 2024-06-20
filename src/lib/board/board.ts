import { resolveURL } from "../util";
import { BoardInfo } from "./info";
import { DataCache, DataCache32 } from "./sector";
import { BoardUpdate, PixelsAvailable } from "./events";

export class BoardStub {
	constructor(
		private readonly location: URL,
		private readonly info?: BoardInfo,
	) {}

	async connect(): Promise<Board> {
		return Board.connect(this.location);
	}
}
export class Board {
	private listeners = {
		"board_update": [] as Array<(data: BoardUpdate) => void>,
		"pixels_available": [] as Array<(data: PixelsAvailable) => void>,
	};

	static async connect(location: URL) {
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
		return new Board(location, socket);
	}
	
	protected readonly colorsCache: DataCache;
	protected readonly timestampsCache: DataCache32;
	protected readonly maskCache: DataCache;
	protected readonly initialCache: DataCache;

	private constructor(
		readonly location: URL,
		private readonly socket: WebSocket,
	) {
		this.onUpdate((u: BoardUpdate) => this.update(u));
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
		
		this.colorsCache = new DataCache(resolveURL(location, "data/colors"));
		this.timestampsCache = new DataCache32(resolveURL(location, "data/timestamps"));
		this.maskCache = new DataCache(resolveURL(location, "data/mask"));
		this.initialCache = new DataCache(resolveURL(location, "data/initial"));
	}

	onUpdate(callback: (packet: BoardUpdate) => void) {
		this.listeners.board_update.push(callback);
	}

	private infoCache?: Promise<BoardInfo>;
	
	info(): Promise<BoardInfo> {
		if (this.infoCache === undefined) {
			this.infoCache = fetch(this.location)
				.then(d => d.json())
				.then(BoardInfo.parse);
		}

		return this.infoCache;
	}

	async colors(sector: number): Promise<Uint8Array> {
		return await this.colorsCache.get(await this.info(), sector);
	}

	async timestamps(sector: number): Promise<Uint32Array> {
		return await this.timestampsCache.get(await this.info(), sector);
	}

	async mask(sector: number): Promise<Uint8Array> {
		return await this.maskCache.get(await this.info(), sector);
	}

	async initial(sector: number): Promise<Uint8Array> {
		return await this.initialCache.get(await this.info(), sector);
	}

	protected async update(update: BoardUpdate) {
		const colorUpdates = update.data?.colors || [];
		const timestampUpdates = update.data?.timestamps || [];
		const maskUpdates = update.data?.mask || [];
		const initialUpdates = update.data?.initial || [];
		const info = await this.info();

		for (const change of colorUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			if ("values" in change) {
				const sector = this.colorsCache.get(info, index);
				if (sector) {
					(await sector).set(change.values, offset);
				}
			} else {
				this.colorsCache.invalidate(index);
			}
		}

		for (const change of timestampUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			if ("values" in change) {
				const sector = this.timestampsCache.get(info, index);
				if (sector) {
					(await sector).set(change.values, offset);
				}
			} else {
				this.colorsCache.invalidate(index);
			}
		}

		for (const change of maskUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			if ("values" in change) {
				const sector = this.maskCache.get(info, index);
				if (sector) {
					(await sector).set(change.values, offset);
				}
			} else {
				this.colorsCache.invalidate(index);
			}
		}

		for (const change of initialUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			if ("values" in change) {
				const sector = this.initialCache.get(info, index);
				if (sector) {
					(await sector).set(change.values, offset);
				}
			} else {
				this.colorsCache.invalidate(index);
			}
		}
	}
	
}