import { z } from "zod";
import { BoardInfo } from "./info";
import { DataCache, DataCache32 } from "./sector";
import { Event, BoardUpdate, PixelsAvailable } from "./events";
import type { Requester } from "../requester";
import { get, writable, type Readable, type Writable } from "svelte/store";
import type { AdminOverrides } from "../settings";
import { Pixel } from "../pixel";
import type { Site } from "../site";
import { sleep, type Parser } from "../util";
import { UserCount } from "../usercount";
import { Pixel as PixelResponse } from "../pixel";
import { persistentWritable } from "../storage/persistent";
import { Templates } from "../render/template";

const HeaderNumber = z.number().int().min(0);

const HeaderCooldown = (parseDate: (time: number) => Date) => z.object({
	"pxls-pixels-available": z.string()
		.transform(s => HeaderNumber.parse(parseInt(s)))
		.optional(),
	"pxls-next-available": z.string()
		.transform(s => HeaderNumber.parse(parseInt(s)))
		.transform(parseDate)
		.optional(),
}).transform(h => ({
	pixelsAvailable: h["pxls-pixels-available"],
	nextTimestamp: h["pxls-next-available"],
}));
export type HeaderCooldown = z.infer<ReturnType<typeof HeaderCooldown>>;
export type Cooldown = {
	pixelsAvailable: number;
	nextTimestamp: Date | undefined;
};

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

		const missedEvents = [] as Array<MessageEvent>;
		function missEvent(e: MessageEvent) {
			missedEvents.push(e);
		}

		const events = Board.events(extensions, access);
		let socket;
		if (events.length > 0) {
			socket = await http.socket("events", events);
			socket.addEventListener("message", missEvent);
		}

		const { cooldown, info, clockDelta, parseTime } = await http.getRaw().then(async (r) => {
			const headers = Object.fromEntries(r.headers.entries());
			const serverTime = new Date(headers.date);
			const clockDelta = writable(Date.now() - serverTime.getTime());
			let delta = 0;
			clockDelta.subscribe(v => delta = v);
			const parseTime = (time: number) => new Date(time * 1000 + delta);

			const headerCooldown = HeaderCooldown(parseTime).parse(headers);
			const cooldown = {
				pixelsAvailable: typeof headerCooldown.pixelsAvailable === "undefined"
					? 0
					: headerCooldown.pixelsAvailable,
				nextTimestamp: headerCooldown.nextTimestamp,
			} as Cooldown;

			const parser = BoardInfo.parser(parseTime);
			const parse = parser(http).parse;

			return {
				cooldown: writable(cooldown),
				info: writable(parse(await r.json())),
				clockDelta,
				parseTime,
			};
		});

		if (typeof socket !== "undefined") {
			socket.removeEventListener("message", missEvent);
		}
		return new Board(site, http, socket, info, cooldown, clockDelta, parseTime, missedEvents);
	}

	private static events(extensions: Set<string>, access: Set<string>) {
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

		return events;
	}

	protected readonly colorsCache: DataCache;
	protected readonly timestampsCache: DataCache32;
	protected readonly maskCache: DataCache;
	protected readonly initialCache: DataCache;
	public readonly info: Readable<BoardInfo>;
	public readonly cooldown: Readable<Cooldown>;
	public readonly templates: Writable<Templates>;

	private readonly parsers: {
		pixel: Parser<Pixel | undefined>;
		userCount: Parser<UserCount>;
	};

	private processMessage(message: MessageEvent) {
		try {
			const packet = Event.parse(JSON.parse(message.data) as unknown);
			switch (packet.type) {
				case "board-update":
					this.queueUpdate(packet);
					break;
				case "pixels-available":
					this.listeners.pixelsAvailable.forEach(l => l(packet));
					break;
			}
		} catch (e) {
			console.error("Failed to parse packet", e);
		}
	}

	get uri(): URL {
		return this.http.baseURL;
	}

	private constructor(
		private readonly site: Site,
		private readonly http: Requester,
		private readonly socket: WebSocket | undefined,
		private readonly infoStore: Writable<BoardInfo>,
		private readonly cooldownStore: Writable<Cooldown>,
		private readonly clockDelta: Writable<number>,
		public readonly parseTime: (time: number) => Date,
		missedEvents: Array<MessageEvent>,
	) {
		this.info = { subscribe: infoStore.subscribe };
		this.cooldown = { subscribe: cooldownStore.subscribe };
		this.onPixelsAvailable(p => this.cooldownStore.set({
			pixelsAvailable: p.count,
			nextTimestamp: typeof p.next === "undefined"
				? undefined
				: parseTime(p.next),
		}));

		for (const event of missedEvents) {
			this.processMessage(event);
		}

		socket?.addEventListener("message", this.processMessage.bind(this));
		socket?.addEventListener("close", this.reconnect.bind(this));

		this.colorsCache = new DataCache(this.http.subpath("data/colors"));
		this.timestampsCache = new DataCache32(this.http.subpath("data/timestamps"));
		this.maskCache = new DataCache(this.http.subpath("data/mask"));
		this.initialCache = new DataCache(this.http.subpath("data/initial"));

		this.parsers = {
			pixel: Pixel.parser(this.site.access(), this.info, this.site.parsers.userReference, this.parseTime),
			userCount: UserCount.parser(),
		};
		const templateKey = `templates[${http.baseURL}]`;
		this.templates = persistentWritable(
			templateKey,
			Templates(this.uri).parse,
			templates => templates.map(t => t.serialize()),
			[],
		);
	}

	private async reconnect() {
		let retries = 0;
		const MAX_RETRIES = 5;
		let socket;
		do {
			const backoffSeconds = 3 ** retries;
			await sleep(1000 * backoffSeconds);

			try {
				const access = get(this.site.access());
				const events = Board.events(this.site.info.extensions, await access);
				if (events.length > 0) {
					socket = await this.http.socket("events", events);
				}
			} catch (_) {
				if (retries === MAX_RETRIES) {
					throw new Error("Failed to reconnect site socket");
				}
				retries += 1;
			}
		} while (typeof socket === "undefined");
		socket?.addEventListener("message", this.processMessage.bind(this));
		socket?.addEventListener("close", this.reconnect.bind(this));

		// An update could come through the socket while we fetch info.
		// If it does, it will always be at least as updated as our request but
		// possibly more so. Because of this, only update if there was no such
		// event:
		const updates = { info: false, cooldown: false };
		const unsubInfo = this.infoStore.subscribe(() => updates.info = true);
		const unsubCooldown = this.cooldown.subscribe(() => updates.cooldown = true);

		const { info, cooldown } = await this.http.getRaw().then(async (response) => {
			const headers = response.headers;
			const headerCooldown = HeaderCooldown(this.parseTime).parse(headers);
			const cooldown = {
				pixelsAvailable: typeof headerCooldown.pixelsAvailable === "undefined"
					? 0
					: headerCooldown.pixelsAvailable,
				nextTimestamp: headerCooldown.nextTimestamp,
			} as Cooldown;

			const parser = BoardInfo.parser(this.parseTime);
			const info = parser(this.http).parse(await response.json());
			return { info, cooldown };
		});

		unsubInfo();
		unsubCooldown();
		if (!updates.info) {
			this.infoStore.set(info);
		}
		if (!updates.cooldown) {
			this.cooldownStore.set(cooldown);
		}

		const [width, height] = get(this.info).shape.size();
		const canvasSize = width * height;
		this.queueUpdate({
			type: "board-update",
			data: {
				colors: [{ position: 0, length: canvasSize }],
				mask: [{ position: 0, length: canvasSize }],
				timestamps: [{ position: 0, length: canvasSize }],
				initial: [{ position: 0, length: canvasSize }],
			},
		});
		// TODO: clear and reload other caches where necessary
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

	private updateQueue = Promise.resolve();
	private queueUpdate(update: BoardUpdate) {
		const queue = this.updateQueue
			.then(() => this.update(update))
			.then(() => this.listeners.boardUpdate.forEach(f => f(update)))
			.then(() => {
				if (queue === this.updateQueue) {
					// trim promises if no more are queued
					this.updateQueue = Promise.resolve();
				}
			});
		this.updateQueue = queue;
	}

	protected async update(update: BoardUpdate) {
		// NOTE: the "!" here tells typescript to assume this is defined as it
		// cannot deduce that the next call will set it.
		let info!: BoardInfo;
		this.infoStore.update((oldInfo) => {
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
		const changedPositions = new Set(pixelInvalidatingUpdates.flatMap((change) => {
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
			const parse = this.parsers.pixel(this.http).parse;
			const pixel = this.http.get("pixels/" + location).then(parse);
			this.pixelCache.set(location, writable(pixel));
		}

		const pixel = this.pixelCache.get(location);
		if (typeof pixel === "undefined") {
			throw new Error("assertion error: pixel cache should contain a value");
		}

		if (typeof get(pixel) === "undefined") {
			const parse = this.parsers.pixel(this.http).parse;
			pixel.set(this.http.get("pixels/" + location).then(parse));
		}

		return pixel;
	}

	async place(position: number, color: number, overrides: AdminOverrides): Promise<PixelResponse | undefined> {
		const extra = {} as { overrides?: AdminOverrides };

		if (overrides.color || overrides.cooldown || overrides.mask) {
			extra.overrides = overrides;
		}

		const shape = get(this.info).shape;
		const [sectorIndex, sectorOffset] = shape.positionToSector(position);
		const sector = await this.colors(sectorIndex);
		const currentColor = sector[sectorOffset];

		if (currentColor === color) {
			return undefined;
		}

		try {
			const response = await this.http.post({ color, ...extra }, `pixels/${position}`);
			const parse = this.parsers.pixel(this.http).parse;
			const data = parse(response.view);
			const undoHeader = response.headers.get("pxls-undo-deadline");
			if (undoHeader !== null) {
				const boardEpoch = get(this.info).createdAt;
				const deadline = this.parseTime(boardEpoch.getTime() / 1000 + parseInt(undoHeader));
				const undo = { position, deadline };
				const now = Date.now();

				if (typeof this.undoTimeout !== "undefined") {
					clearTimeout(this.undoTimeout);
				}

				setTimeout(() => this.pruneUndos(), deadline.getTime() - now);

				get(this.undosState).push(undo);
				// NOTE: triggers a refresh on undoState which we just updated.
				this.pruneUndos();
			}
			return data;
		} catch (_) {
			return undefined;
		}
	}

	private userCountCache?: Writable<Promise<UserCount>>;
	userCount(): Readable<Promise<UserCount>> {
		if (typeof this.userCountCache === "undefined") {
			const parse = this.parsers.userCount(this.http).parse;
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

	private undoTimeout: number | undefined;
	private undosState: Writable<Array<{ position: number; deadline: Date }>> = writable([]);
	undos(): Readable<Array<{ position: number; deadline: Date }>> {
		return this.undosState;
	}

	private pruneUndos() {
		const now = Date.now();
		return this.undosState.update((undos) => {
			return undos.filter(u => u.deadline.getTime() > now);
		});
	}

	async undo(position: number): Promise<void> {
		let resolve: (v: unknown) => void;
		let reject: (v: unknown) => void;
		const promise = new Promise((good, bad) => {
			resolve = good;
			reject = bad;
		});

		this.undosState.update((undos) => {
			const undoIndex = undos.findLastIndex(undo => undo.position === position);

			if (undoIndex !== -1) {
				const undo = undos.splice(undoIndex, 1)[0];
				this.http.delete(`pixels/${undo.position}`).then(resolve);
			} else {
				reject(new Error("Tried to undo an unknown pixel"));
			}

			return undos;
		});

		await promise;
	}
}
