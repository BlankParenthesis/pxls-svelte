import { z } from "zod";
import { BoardInfo } from "./info";
import { DataCache, DataCache32 } from "./sector";
import { Event, BoardUpdate, PixelsAvailable } from "./events";
import type { Requester } from "../requester";
import { get, writable, type Readable, type Writable } from "svelte/store";
import type { AdminOverrides } from "../settings";
import { Pixel } from "../pixel";
import type { Site } from "../site";
import { navigationState } from "../../components/Login.svelte";
import type { Parser } from "../util";
import { UserCount } from "../usercount";

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

export class Board {
	private listeners = {
		boardUpdate: [] as Array<(data: BoardUpdate) => void>,
		pixelsAvailable: [] as Array<(data: PixelsAvailable) => void>,
	};

	static async connect(site: Site, http: Requester): Promise<Board> {
		const extensions = site.info.extensions;
		const access = await get(site.access());

		if (!extensions.has("board_timestamps")) {
			throw new Error("TODO: render without timestamps");
		}

		if (!access.has("boards.data.get")) {
			throw new Error("Forbidden from viewing board data");
		}

		const events = [];

		if (access.has("boards.events.cooldown")) {
			events.push("cooldown");
		}

		if (access.has("boards.events.data.colors")) {
			console.warn("Not allowed to listen to board changes");
			events.push("data.colors");
		}

		if (extensions.has("board_timestamps") && access.has("boards.events.data.timestamps")) {
			events.push("data.timestamps");
		}

		if (extensions.has("board_lifecycle") && access.has("boards.events.info")) {
			events.push("info");
		}
		
		const missedEvents = [] as Array<MessageEvent>;
		function missEvent(e: MessageEvent) {
			missedEvents.push(e);
		}
		
		let socket;
		if (events.length > 0) {
			socket = await http.socket("events", events);
			socket.addEventListener("message", missEvent);
		}
		const parser = BoardInfo.parser();
		const parse = parser(http);

		const { cooldown, info } = await http.getRaw().then(async r => ({
			cooldown: writable(Cooldown.parse(Object.fromEntries(r.headers.entries()))),
			info: writable(parse(await r.json())),
		}));

		if (typeof socket !== "undefined") {
			socket = await http.socket("events", events);
			socket.removeEventListener("message", missEvent);
		}
		return new Board(site, http, socket, info, cooldown, missedEvents);
	}
	
	protected readonly colorsCache: DataCache;
	protected readonly timestampsCache: DataCache32;
	protected readonly maskCache: DataCache;
	protected readonly initialCache: DataCache;
	public readonly info: Readable<BoardInfo>;
	public readonly cooldown: Readable<Cooldown>;

	private readonly parsers: {
		pixel: Parser<Pixel>,
		userCount: Parser<UserCount>,
	};

	private processMessage(message: MessageEvent) {
		try {
			const packet = Event.parse(JSON.parse(message.data) as unknown);
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
	}

	private constructor(
		private readonly site: Site,
		private readonly http: Requester,
		private readonly socket: WebSocket | undefined,
		private readonly infoStore: Writable<BoardInfo>,
		private readonly cooldownStore: Writable<Cooldown>,
		missedEvents: Array<MessageEvent>,
	) {
		this.info = { subscribe: infoStore.subscribe };
		this.cooldown = { subscribe: cooldownStore.subscribe };
		this.onUpdate(u => this.update(u));
		this.onPixelsAvailable(p => this.cooldownStore.set({
			pixelsAvailable: p.count,
			nextTimestamp: p.next,
		}));

		for (const event of missedEvents) {
			this.processMessage(event);
		}

		socket?.addEventListener("message", e => this.processMessage(e));

		socket?.addEventListener("close", () => {
			// TODO: as with socket, proper state handling to recover from this
			if (!navigationState.navigating) {
				document.location.reload();
			}
		});
		
		this.colorsCache = new DataCache(this.http.subpath("data/colors"));
		this.timestampsCache = new DataCache32(this.http.subpath("data/timestamps"));
		this.maskCache = new DataCache(this.http.subpath("data/mask"));
		this.initialCache = new DataCache(this.http.subpath("data/initial"));

		this.parsers = {
			pixel: Pixel.parser(this.site.access(), this.info, this.site.parsers.userReference),
			userCount: UserCount.parser(),
		};
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
			if (typeof update.info?.name !== "undefined") {
				oldInfo.name = update.info.name;
			}

			if (typeof update.info?.shape !== "undefined") {
				throw new Error("TODO: shape change handling");
			}

			if (typeof update.info?.max_pixels_available !== "undefined") {
				oldInfo.maxPixelsAvailable = update.info.max_pixels_available;
			}
			
			if (typeof update.info?.palette !== "undefined") {
				oldInfo.palette = update.info.palette;
			}

			return info = oldInfo;
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
				this.timestampsCache.invalidate(index);
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
				this.maskCache.invalidate(index);
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
				this.initialCache.invalidate(index);
			}
		}

		const pixelInvalidatingUpdates = colorUpdates.concat(timestampUpdates);
		const changedPositions = new Set(pixelInvalidatingUpdates.flatMap(change => {
			const length = ("values" in change) ? change.values.length : change.length;
			return new Array(length)
				.fill(0)
				.map((_, i) => change.position + i);
		}));

		for (const position of changedPositions) {
			// this notifies anything that may have a reference that this is now invalid.
			this.pixelCache.get(position)?.set(undefined);
			this.pixelCache.delete(position);
		}
	}

	private pixelCache: Map<number, Writable<Promise<Pixel | undefined> | undefined>> = new Map();
	pixel(location: number): Readable<Promise<Pixel | undefined> | undefined> {
		if (!this.pixelCache.has(location)) {
			const parse = this.parsers.pixel(this.http);
			const pixel = this.http.get("pixels/" + location).then(parse);
			this.pixelCache.set(location, writable(pixel));
		}
		
		const pixel = this.pixelCache.get(location);
		if (typeof pixel === "undefined") {
			throw new Error("assertion error: pixel cache should contain a value");
		}
		return pixel;
	}
	
	async place(position: number, color: number, overrides: AdminOverrides): Promise<PlaceResult> {
		const extra = {} as { overrides?: AdminOverrides };

		if (overrides.color || overrides.cooldown || overrides.mask) {
			extra.overrides = overrides;
		}
		
		const shape = get(this.info).shape;
		const [sectorIndex, sectorOffset] = shape.positionToSector(position);
		const sector = await this.colors(sectorIndex);
		const currentColor = sector[sectorOffset];
		
		if (currentColor === color) { 
			return false;
		}
		
		try {
			await this.http.post({ color, ...extra }, `pixels/${position}`);
			return true;
		} catch(_) {
			return false;
		}
	}

	private userCountCache?: Writable<Promise<UserCount>>;
	userCount(): Readable<Promise<UserCount>> {
		if (typeof this.userCountCache === "undefined") {
			const parse = this.parsers.userCount(this.http);
			const userCount = this.http.get("users").then(parse);
			this.userCountCache = writable(userCount);

			setInterval(() => {
				const userCount = this.http.get("users").then(parse);
				if (typeof this.userCountCache !== "undefined") {
					this.userCountCache.set(userCount);
				}
			}, 60 * 1000); // manually refresh every 60 seconds
		}

		return this.userCountCache;
	}
}
