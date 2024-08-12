import { z } from "zod";

import { Extension } from "./extensions";
import { Permissions } from "./permissions";
import { BoardStub } from "./board/board";
import { resolveURL } from "./util";
import { SiteAuthUnverified, Authentication } from "./authentication";
import { Requester } from "./requester";
import { User, UserReference } from "./user";
import { Role } from "./role";
import { Event } from "./events";
import { BoardReference, BoardsPage } from "./board/info";
import { writable, type Readable, type Writable } from "svelte/store";

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

		const http = new Requester(location, auth.token);
		const events = [
			"users.current", // TODO: this is an extension
			"users.current.roles", // TODO: this is an extension
		];
		const socket = await http.socket("events", events);

		return new Site(http, info, auth, socket);
	}

	private constructor(
		private readonly http: Requester,
		private readonly info: SiteInfo,
		readonly auth: Authentication,
		private readonly socket: WebSocket,
	) {
		socket.addEventListener("message", e => {
			try {
				const packet = Event.parse(JSON.parse(e.data) as unknown);
				let user: Promise<User>;
				switch (packet.type) {
					case "user-updated": 
						if (typeof packet.user.view !== "undefined") {
							user = Promise.resolve(new User(
								this,
								this.http.subpath(packet.user.uri),
								packet.user.view.name,
								packet.user.view.created_at,
							));
						} else {
							user = this.http.get(packet.user.uri)
								.then(User.parse)
								.then(u => new User(
									this,
									this.http.subpath(packet.user.uri),
									u.name,
									u.created_at,
								));
						}
						if (this.userCache.has(packet.user.uri)) {
							// TODO: .update() to preserve cache?
							this.userCache.get(packet.user.uri)?.set(user);
						} else {
							this.userCache.set(packet.user.uri, writable(user));
						}
						break;
					case "user-roles-updated": 
						this.userCache.get(packet.user)?.update(p => {
							return p.then(u => {
								u.updateRoles();
								return u;
							});
						});
						break;
				}
			} catch(e) {
				console.error("Failed to parse packet", e);
			}
		});
	}

	private userCache: Map<string, Writable<Promise<User>>> = new Map();
	user(location: string): Readable<Promise<User>> {
		if (!this.userCache.has(location)) {
			const user = this.http.get(location)
				.then(User.parse)
				.then(u => new User(
					this,
					this.http.subpath(location),
					u.name,
					u.created_at,
				));
			this.userCache.set(location, writable(user));
		}
		
		const user = this.userCache.get(location);
		if (typeof user === "undefined") {
			throw new Error("assertion error: user cache should contain a value");
		}
		return user;
	}

	private roleCache: Map<string, Writable<Promise<Role>>> = new Map();
	role(location: string): Readable<Promise<Role>> {
		if (!this.roleCache.has(location)) {
			const role = this.http.get(location)
				.then(Role.parse);
			this.roleCache.set(location, writable(role));
		}
		
		const role = this.roleCache.get(location);
		if (typeof role === "undefined") {
			throw new Error("assertion error: role cache should contain a value");
		}
		return role;
	}

	cacheRole(location: string, role: Promise<Role>): Readable<Promise<Role>> {
		if (!this.roleCache.has(location)) {
			this.roleCache.set(location, writable(role));
		}

		const cachedRole = this.roleCache.get(location);
		if (typeof cachedRole === "undefined") {
			throw new Error("assertion error: role cache should contain a value");
		}
		return cachedRole;
	}

	// TODO: invalidate on auth change
	private currentUserCache?: Writable<Promise<string>>;
	currentUser(): Readable<Promise<string>> {
		if (typeof this.currentUserCache === "undefined") {
			// TODO: use view if available?
			const uri = this.http.get("users/current")
				.then(UserReference.parse)
				.then(u => u.uri);

			this.currentUserCache = writable(uri);
		}

		return this.currentUserCache;
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