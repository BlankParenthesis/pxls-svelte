import type { Board, BoardInfo, BoardUpdate, BoardUsersInfo, PixelsAvailable, Placement } from "./backend";

export abstract class CachedBoard implements Board {
	private infoCache?: Promise<BoardInfo>;
	protected readonly colorsCache = new Map<number, Promise<Uint8Array>>();
	protected readonly timestampsCache = new Map<number, Promise<Uint32Array>>();
	protected readonly maskCache = new Map<number, Promise<Uint8Array>>();
	protected readonly initialCache = new Map<number, Promise<Uint8Array>>();

	abstract on(event: "board_update", callback: (data: BoardUpdate) => void): void;
	abstract on(event: "pixels_available", callback: (data: PixelsAvailable) => void): void;

	abstract users(): Promise<BoardUsersInfo>;
	abstract pixels(): AsyncGenerator<Placement>;
	abstract lookup(position: number): Promise<Placement | null>;
	abstract place(position: number, color: number): Promise<Placement>;
	
	protected abstract fetchInfo(): Promise<BoardInfo>;
	protected abstract fetchColors(sector: number): Promise<Uint8Array>;
	protected abstract fetchTimestamps(sector: number): Promise<Uint32Array>;
	protected abstract fetchMask(sector: number): Promise<Uint8Array>;
	protected abstract fetchInitial(sector: number): Promise<Uint8Array>;
	
	protected async update(update: BoardUpdate) {
		const colorUpdates = update.data?.colors || [];
		const timestampUpdates = update.data?.timestamps || [];
		const maskUpdates = update.data?.mask || [];
		const initialUpdates = update.data?.initial || [];
		const info = await this.info();

		for (const change of colorUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.colorsCache.get(index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}

		for (const change of timestampUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.timestampsCache.get(index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}

		for (const change of maskUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.maskCache.get(index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}

		for (const change of initialUpdates) {
			const [index, offset] = info.shape.positionToSector(change.position);
			const sector = this.initialCache.get(index);
			if (sector) {
				(await sector).set(change.values, offset);
			}
		}
	}
	
	private static getOrGenerate<K, V>(
		map: Map<K ,V>,
		generate: (key: K) => V,
		key: K,
	): V {
		let value = map.get(key);

		if (value === undefined) {
			value = generate(key);
			map.set(key, value);
		}

		return value;
	}

	protected invalidateInfo() {
		this.infoCache = undefined;
	}

	protected invalidateColors(index: number) {
		this.colorsCache.delete(index);
	}

	protected invalidateTimestamps(index: number) {
		this.timestampsCache.delete(index);
	}

	protected invalidateMask(index: number) {
		this.maskCache.delete(index);
	}

	protected invalidateInitial(index: number) {
		this.initialCache.delete(index);
	}
	
	info(): Promise<BoardInfo> {
		if (this.infoCache === undefined) {
			this.infoCache = this.fetchInfo();
		}

		return this.infoCache;
	}
	
	colors(sectorIndices: number[]): Promise<Uint8Array[]> {
		return Promise.all(sectorIndices.map(i => {
			return CachedBoard.getOrGenerate(
				this.colorsCache,
				this.fetchColors.bind(this),
				i,
			);
		}));
	}
	
	timestamps(sectorIndices: number[]): Promise<Uint32Array[]> {
		return Promise.all(sectorIndices.map(i => {
			return CachedBoard.getOrGenerate(
				this.timestampsCache,
				this.fetchTimestamps.bind(this),
				i,
			);
		}));
	}
	
	mask(sectorIndices: number[]): Promise<Uint8Array[]> {
		return Promise.all(sectorIndices.map(i => {
			return CachedBoard.getOrGenerate(
				this.maskCache,
				this.fetchColors.bind(this),
				i,
			);
		}));
	}
	
	initial(sectorIndices: number[]): Promise<Uint8Array[]> | null {
		return Promise.all(sectorIndices.map(i => {
			return CachedBoard.getOrGenerate(
				this.initialCache,
				this.fetchInitial.bind(this),
				i,
			);
		}));
	}
}