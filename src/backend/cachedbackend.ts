import type { Board, BoardInfo, BoardUsersInfo, Placement } from "./backend";

export abstract class CachedBoard implements Board {
	private infoCache?: Promise<BoardInfo>;
	private readonly colorsCache = new Map<number, Promise<Uint8Array>>();
	private readonly timestampsCache = new Map<number, Promise<Uint32Array>>();
	private readonly maskCache = new Map<number, Promise<Uint8Array>>();
	private readonly initialCache = new Map<number, Promise<Uint8Array>>();

	abstract users(): Promise<BoardUsersInfo>;
	abstract pixels(): AsyncGenerator<Placement>;
	abstract lookup(position: number): Promise<Placement | null>;
	abstract place(position: number, color: number): Promise<Placement>;
	
	protected abstract fetchInfo(): Promise<BoardInfo>;
	protected abstract fetchColors(sector: number): Promise<Uint8Array>;
	protected abstract fetchTimestamps(sector: number): Promise<Uint32Array>;
	protected abstract fetchMask(sector: number): Promise<Uint8Array>;
	protected abstract fetchInitial(sector: number): Promise<Uint8Array>;
	
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