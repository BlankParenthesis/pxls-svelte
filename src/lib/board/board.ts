import { z } from "zod";
import { BoardInfo } from "./info";
import { DataCache, DataCache32 } from "./sector";
import { Event, BoardUpdate, PixelsAvailable } from "./events";
import type { Requester } from "../requester";
import { get, writable, type Readable, type Writable } from "svelte/store";

type PlaceResult = boolean; // TODO: a bit more detail would be nice

const HeaderNumber = z.number().int().min(0);

const Cooldown = z.object({
	"pxls-pixels-available": z.string()
		.transform(s => HeaderNumber.parse(parseInt(s)))
		.optional(),
	"pxls-next-available": z.string()
		.transform(s => HeaderNumber.parse(parseInt(s)))
		.optional(),
}).transform(h => ({
	pixelsAvailable: h["pxls-pixels-available"],
	nextTimestamp: h["pxls-next-available"],
}));
export type Cooldown = z.infer<typeof Cooldown>;
export class BoardStub {
	constructor(
		private readonly http: Requester,
		readonly info?: BoardInfo,
	) {}

	async connect(): Promise<Board> {
		return Board.connect(this.http);
	}

	get uri(): URL {
		return this.http.baseURL;
	}
}
export class Board {
	private listeners = {
		boardUpdate: [] as Array<(data: BoardUpdate) => void>,
		pixelsAvailable: [] as Array<(data: PixelsAvailable) => void>,
	};

	static async connect(http: Requester) {
		const events = [
			"cooldown",
			"data.colors",
			"data.timestamps", // TODO: this is an extension, test if it's available
			"info", // TODO: this is also an extension
		];
		const socket = await http.socket("events", events);
		// TODO: catch events in socket and replay them after this is fetched
		const { cooldown, info } = await http.getRaw().then(async r => ({
			cooldown: writable(Cooldown.parse(Object.fromEntries(r.headers.entries()))),
			info: writable(BoardInfo.parse(await r.json())),
		}));
		return new Board(http, socket, info, cooldown);
	}
	
	protected readonly colorsCache: DataCache;
	protected readonly timestampsCache: DataCache32;
	protected readonly maskCache: DataCache;
	protected readonly initialCache: DataCache;
	public readonly info: Readable<BoardInfo>;
	public readonly cooldown: Readable<Cooldown>;

	private constructor(
		private readonly http: Requester,
		private readonly socket: WebSocket,
		private readonly infoStore: Writable<BoardInfo>,
		private readonly cooldownStore: Writable<Cooldown>,
	) {
		this.info = { subscribe: infoStore.subscribe };
		this.cooldown = { subscribe: cooldownStore.subscribe };
		this.onUpdate(u => this.update(u));
		this.onPixelsAvailable(p => this.cooldownStore.set({
			pixelsAvailable: p.count,
			nextTimestamp: p.next,
		}));
		socket.addEventListener("message", e => {
			try {
				const packet = Event.parse(JSON.parse(e.data) as unknown);
				switch (packet.type) {
					case "board-update": 
						this.listeners.boardUpdate.forEach(l => l(packet));
						break;
					case "pixels-available": 
						this.listeners.pixelsAvailable.forEach(l => l(packet));
						break;
				}
			} catch(e) {
				console.error("Failed to parse packet", e);
			}
		});
		
		this.colorsCache = new DataCache(this.http.subpath("data/colors"));
		this.timestampsCache = new DataCache32(this.http.subpath("data/timestamps"));
		this.maskCache = new DataCache(this.http.subpath("data/mask"));
		this.initialCache = new DataCache(this.http.subpath("data/initial"));
	}

	onUpdate(callback: (packet: BoardUpdate) => void) {
		this.listeners.boardUpdate.push(callback);
	}

	onPixelsAvailable(callback: (packet: PixelsAvailable) => void) {
		this.listeners.pixelsAvailable.push(callback);
	}
	
	async colors(sector: number): Promise<Uint8Array> {
		return await this.colorsCache.get(get(this.info), sector);
	}

	async timestamps(sector: number): Promise<Uint32Array> {
		return await this.timestampsCache.get(get(this.info), sector);
	}

	async mask(sector: number): Promise<Uint8Array> {
		return await this.maskCache.get(get(this.info), sector);
	}

	async initial(sector: number): Promise<Uint8Array> {
		return await this.initialCache.get(get(this.info), sector);
	}

	protected async update(update: BoardUpdate) {
		// NOTE: the "!" here tells typescript to assume this is defined as it
		// cannot deduce that the next call will set it.
		let info!: BoardInfo;
		this.infoStore.update(oldInfo => {
			if (typeof update.info?.shape !== "undefined") {
				throw new Error("TODO: shape change handling");
			}

			info = { ...oldInfo, ...update.info };
			return info;
		});

		const colorUpdates = update.data?.colors || [];
		const timestampUpdates = update.data?.timestamps || [];
		const maskUpdates = update.data?.mask || [];
		const initialUpdates = update.data?.initial || [];

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
	
	async place(x: number, y: number, color: number): Promise<PlaceResult> {
		const shape = get(this.info).shape;
		const indexArray = shape.coordinatesToIndexArray(x, y);
		const position = shape.indexArrayToPosition(indexArray);
		
		try {
			await this.http.post({ color }, `pixels/${position}`);
			return true;
		} catch(_) {
			return false;
		}
	}
}