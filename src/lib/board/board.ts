import { z } from "zod";

import type { BoardUpdate, OnEventArguments, PixelsAvailable } from "./canvas";
import { color } from "./palette";
import { resolveURL } from "../util";
import { Shape } from "../render/shape";

/* eslint camelcase: off */
export const BoardInfo = z.object({
	name: z.string(),
	created_at: z.number(),
	shape: z.array(z.array(z.number()).length(2)).min(1)
		.transform(s => {
			if (s.length === 0) {
				throw new Error("Degenerate board shape");
			} else if (s.length === 1) {
				return new Shape([[1,1], s[0] as [number, number]]);
			} else {
				return new Shape(s as Array<[number, number]>);
			}
		}),
	max_pixels_available: z.number(),
	palette: z.record(
		z.string().transform(i => parseInt(i)).pipe(z.number()),
		color,
	).transform(o => new Map(Object.entries(o).map(([k, v]) => [parseInt(k), v]))),
});
export type BoardInfo = z.infer<typeof BoardInfo>;

export class BoardStub {
	constructor(
		private readonly location: URL,
		private readonly info?: BoardInfo,
	) {}

	async connect(): Promise<Board> {
		return Board.connect(this.location);
	}
}

function sectorRange(info: BoardInfo, sector: number, multiplier = 1): string {
	const [width, height] = info.shape.sectorSize();
	const sectorSize = width * height * multiplier;
	const sectorStart = sectorSize * sector;
	const sectorEnd = sectorStart + sectorSize;
	return "bytes=" + sectorStart + "-" + sectorEnd;
}

class DataCache {
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
}

class DataCache32 {
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
		
		this.colorsCache = new DataCache(resolveURL(location, "data/colors"));
		this.timestampsCache = new DataCache32(resolveURL(location, "data/timestamps"));
		this.maskCache = new DataCache(resolveURL(location, "data/mask"));
		this.initialCache = new DataCache(resolveURL(location, "data/initial"));
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
			const sector = this.colorsCache.get(info, index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}

		for (const change of timestampUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.timestampsCache.get(info, index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}

		for (const change of maskUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.maskCache.get(info, index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}

		for (const change of initialUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.initialCache.get(info, index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}
	}
	
}