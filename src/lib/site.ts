import { z } from "zod";

import { Extension } from "./extensions";
import { Permissions } from "./permissions";
import { BoardStub } from "./board/board";
import { resolveURL } from "./util";
import { BoardReference } from "./reference";
import { BoardsPage } from "./page";
import { SiteAuthUnverified, Authentication } from "./authentication";
import { Requester } from "./requester";

const SiteInfo = z.object({
	name: z.string().nullable().optional(),
	version: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	extensions: z.array(Extension),
});
export type SiteInfo = z.infer<typeof SiteInfo>;

export class Site {
	static async connect(location: URL): Promise<Site> {
		const info: SiteInfo = await fetch(resolveURL(location, "info"))
			.then(r => r.json())
			.then(j => SiteInfo.parse(j));

		if (!info.extensions.includes("authentication")) {
			throw new Error("TODO: anonymous canvas");
		}

		const auth = await fetch(resolveURL(location, "auth"))
			.then(r => r.json())
			.then(j => SiteAuthUnverified.parse(j))
			.then(a => Authentication.login(a));

		return new Site(location, info, auth);
	}

	private readonly http: Requester;
	private constructor(
		location: URL,
		private readonly info: SiteInfo,
		readonly auth: Authentication,
	) {
		this.http = new Requester(location, auth.token);
	}

	private accessCache?: Promise<Permissions>;
	access(): Promise<Permissions> {
		if (typeof this.accessCache === "undefined") {
			this.accessCache = this.http.get("access")
				.then(j => Permissions.parse(j));
		}

		return this.accessCache;
	}

	async *boards() {
		let boards = await this.http.get("boards")
			.then(j => BoardsPage.parse(j));
		while(true) {
			for (const board of boards.items) {
				yield new BoardStub(this.http.subpath(board.uri), board.view);
			}
			if (boards.next) {
				boards = await this.http.get(boards.next)
					.then(j => BoardsPage.parse(j));
			} else {
				break;
			}
		}
	}
	
	async defaultBoard(): Promise<BoardStub> {
		const board = await this.http.get("boards/default")
			.then(BoardReference.parse);

		return new BoardStub(this.http.subpath(board.uri), board.view);
	}
}