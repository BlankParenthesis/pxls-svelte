import { z } from "zod";

import { Extension } from "./extensions";
import { Permission } from "./permissions";
import { Cache } from "./cache";
import { BoardStub } from "./board/board";
import { BoardReference, resolveURL } from "./util";


const SiteInfo = z.object({
	name: z.string().nullable().optional(),
	version: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	extensions: z.array(Extension),
});
export type SiteInfo = z.infer<typeof SiteInfo>;

const Permissions = z.set(Permission);
type Permissions = z.infer<typeof Permissions>;

export class Site {
	private readonly cache: Cache;

	constructor(
		private readonly location: URL,
	) {
		this.cache = new Cache(location);
	}

	async access(): Promise<Permissions> {
		return await this.cache.get("access", Permissions.parse);
	}

	async info(): Promise<SiteInfo> {
		const permissions = await this.access();
		if (permissions.has("info")) {
			return await this.cache.get("info", SiteInfo.parse);
		} else {
			throw new Error("Missing permissions");
		}
	}

	async authentication(): Promise<string | null> {
		throw new Error("TODO");
	}

	async *boards() {
		throw new Error("TODO");
		yield await this.defaultBoard();
	}
	
	async defaultBoard(): Promise<BoardStub> {
		const url = resolveURL(this.location, "boards/default");

		const board = await fetch(url)
			.then(r => r.json())
			.then(BoardReference.parse);

		return new BoardStub(resolveURL(this.location, board.uri));
	}
}