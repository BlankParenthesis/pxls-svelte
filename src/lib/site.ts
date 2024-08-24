import { z } from "zod";

import { Extension } from "./extensions";
import { Permissions } from "./permissions";
import { BoardStub } from "./board/board";
import { resolveURL } from "./util";
import { SiteAuthUnverified, Authentication } from "./authentication";
import { Requester } from "./requester";
import { RawUser, User, UserReference } from "./user";
import { Role, RoleReference } from "./role";
import { Event } from "./events";
import { BoardReference, BoardsPage } from "./board/info";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { Faction, FactionReference, FactionsPage, RawFaction } from "./faction";
import { FactionMember, FactionMemberReference, RawFactionMember } from "./factionmember";

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
		// TODO: filter by available extensions
		const events = [
			"users.current", 
			"users.current.roles",
			"factions.current",
			"factions.current.members",
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
				let member: Promise<FactionMember>;
				let faction: Promise<Faction>;
				switch (packet.type) {
					case "user-updated": 
						if (typeof packet.user.view !== "undefined") {
							user = Promise.resolve(new User(
								this,
								this.http.subpath(packet.user.uri),
								packet.user.view.name,
								packet.user.view.created_at,
								packet.user.uri,
							));
						} else {
							user = this.http.get(packet.user.uri)
								.then(User.parse)
								.then(u => new User(
									this,
									this.http.subpath(packet.user.uri),
									u.name,
									u.created_at,
									packet.user.uri,
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
					case "faction-created": throw new Error("TODO");
					case "faction-updated": 
						if (typeof packet.faction.view !== "undefined") {
							faction = Promise.resolve(new Faction(
								this,
								this.http.subpath(packet.faction.uri),
								packet.faction.view.name,
								packet.faction.view.created_at,
								packet.faction.view.size,
							));
						} else {
							faction = this.http.get(packet.faction.uri)
								.then(Faction.parse)
								.then(f => new Faction(
									this,
									this.http.subpath(packet.faction.uri),
									f.name,
									f.created_at,
									f.size,
								));
						}
						if (this.factionCache.has(packet.faction.uri)) {
							// TODO: .update() to preserve cache?
							this.factionCache.get(packet.faction.uri)?.set(faction);
						} else {
							this.factionCache.set(packet.faction.uri, writable(faction));
						}
						break;
					case "faction-deleted": throw new Error("TODO");
					case "faction-member-updated": 
						if (typeof packet.faction.view !== "undefined") {
							faction = Promise.resolve(new Faction(
								this,
								this.http.subpath(packet.faction.uri),
								packet.faction.view.name,
								packet.faction.view.created_at,
								packet.faction.view.size,
							));
						} else {
							faction = this.http.get(packet.faction.uri)
								.then(Faction.parse)
								.then(f => new Faction(
									this,
									this.http.subpath(packet.faction.uri),
									f.name,
									f.created_at,
									f.size,
								));
						}
						if (this.factionCache.has(packet.faction.uri)) {
							// TODO: .update() to preserve cache?
							this.factionCache.get(packet.faction.uri)?.set(faction);
						} else {
							this.factionCache.set(packet.faction.uri, writable(faction));
						}

						if (typeof packet.member.view !== "undefined") {
							member = Promise.resolve(new FactionMember(
								this.http.subpath(packet.member.uri),
								packet.member.view.join_intent,
								packet.member.view.owner,
								packet.member.view.user?.uri,
							));
						} else {
							member = this.http.get(packet.member.uri)
								.then(FactionMember.parse)
								.then(m => new FactionMember(
									this.http.subpath(packet.member.uri),
									m.join_intent,
									m.owner,
									m.user?.uri,
								));
						}
						if (this.factionMemberCache.has(packet.member.uri)) {
							// TODO: .update() to preserve cache?
							this.factionMemberCache.get(packet.member.uri)?.set(member);
						} else {
							this.factionMemberCache.set(packet.member.uri, writable(member));
						}

						// Mark the faction current member if the faction
						// doesn't have it set.
						Promise.all([member, faction, get(this.currentUser())])
							.then(([member, faction, currentUser]) => {
								if (member.user === currentUser) {
									faction.initCurrentMember(member);
									const user = this.userCache.get(currentUser);
									if (typeof user !== "undefined") {
										get(user).then(u => {
											u.updatefactions();
										});
									}
								}
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
					location,
				));
			this.userCache.set(location, writable(user));
		}
		
		const user = this.userCache.get(location);
		if (typeof user === "undefined") {
			throw new Error("assertion error: user cache should contain a value");
		}
		return user;
	}

	private cacheUser(location: string, rawuser: Promise<RawUser>): Readable<Promise<User>> {
		if (!this.userCache.has(location)) {
			const user = rawuser.then(u => new User(
				this,
				this.http.subpath(location),
				u.name,
				u.created_at,
				location,
			));
			
			this.userCache.set(location, writable(user));
		}

		const cachedUser = this.userCache.get(location);
		if (typeof cachedUser === "undefined") {
			throw new Error("assertion error: role cache should contain a value");
		}
		return cachedUser;
	}

	userFromReference(reference: UserReference): Readable<Promise<User>> {
		if (typeof reference.view !== "undefined") {
			return this.cacheUser(reference.uri, Promise.resolve(reference.view));
		} else {
			return this.user(reference.uri);
		}
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

	private cacheRole(location: string, role: Promise<Role>): Readable<Promise<Role>> {
		if (!this.roleCache.has(location)) {
			this.roleCache.set(location, writable(role));
		}

		const cachedRole = this.roleCache.get(location);
		if (typeof cachedRole === "undefined") {
			throw new Error("assertion error: role cache should contain a value");
		}
		return cachedRole;
	}

	roleFromReference(reference: RoleReference): Readable<Promise<Role>> {
		if (typeof reference.view !== "undefined") {
			return this.cacheRole(reference.uri, Promise.resolve(reference.view));
		} else {
			return this.role(reference.uri);
		}
	}

	private factionCache: Map<string, Writable<Promise<Faction>>> = new Map();
	faction(location: string): Readable<Promise<Faction>> {
		if (!this.factionCache.has(location)) {
			const faction = this.http.get(location)
				.then(Faction.parse)
				.then(f => new Faction(
					this,
					this.http.subpath(location),
					f.name,
					f.created_at,
					f.size,
				));
			this.factionCache.set(location, writable(faction));
		}
		
		const faction = this.factionCache.get(location);
		if (typeof faction === "undefined") {
			throw new Error("assertion error: faction cache should contain a value");
		}
		return faction;
	}

	private cacheFaction(location: string, faction: Promise<RawFaction>): Readable<Promise<Faction>> {
		if (!this.factionCache.has(location)) {
			const f = faction.then(f => new Faction(
				this,
				this.http.subpath(location),
				f.name,
				f.created_at,
				f.size,
			));

			this.factionCache.set(location, writable(f));
		}

		const cachedFaction = this.factionCache.get(location);
		if (typeof cachedFaction === "undefined") {
			throw new Error("assertion error: faction cache should contain a value");
		}
		return cachedFaction;
	}

	factionFromReference(reference: FactionReference): Readable<Promise<Faction>> {
		if (typeof reference.view !== "undefined") {
			return this.cacheFaction(reference.uri, Promise.resolve(reference.view));
		} else {
			return this.faction(reference.uri);
		}
	}

	private factionMemberCache: Map<string, Writable<Promise<FactionMember>>> = new Map();
	factionMember(location: string): Readable<Promise<FactionMember>> {
		if (!this.factionMemberCache.has(location)) {
			const factionMember = this.http.get(location)
				.then(f => {
					if (typeof f === "undefined") {
						return FactionMember.default();
					} else {
						return FactionMember.parse(f);
					}
				})
				.then(m => new FactionMember(
					this.http.subpath(location),
					m.join_intent,
					m.owner,
					m.user?.uri,
				));
			this.factionMemberCache.set(location, writable(factionMember));
		}
		
		const faction = this.factionMemberCache.get(location);
		if (typeof faction === "undefined") {
			throw new Error("assertion error: faction member cache should contain a value");
		}
		return faction;
	}

	private cacheFactionMember(location: string, member: Promise<RawFactionMember>): Readable<Promise<FactionMember>> {
		if (!this.factionMemberCache.has(location)) {
			const m = member.then(m => new FactionMember(
				this.http.subpath(location),
				m.join_intent,
				m.owner,
				m.user?.uri,
			));
			this.factionMemberCache.set(location, writable(m));
		}

		const cachedFaction = this.factionMemberCache.get(location);
		if (typeof cachedFaction === "undefined") {
			throw new Error("assertion error: faction member cache should contain a value");
		}
		return cachedFaction;
	}

	factionMemberFromReference(reference: FactionMemberReference): Readable<Promise<FactionMember>> {
		if (typeof reference.view !== "undefined") {
			return this.cacheFactionMember(reference.uri, Promise.resolve(reference.view));
		} else {
			return this.factionMember(reference.uri);
		}
	}

	async *searchFactions(name: string) {
		const query = "?name=" + encodeURIComponent("*" + name + "*");
		// TODO: check permissions
		let factions = await this.http.get("factions" + query)
			.then(j => FactionsPage.parse(j));
		while(true) {
			for (const reference of factions.items) {
				let faction: Readable<Promise<Faction>>;
				if (typeof reference.view !== "undefined") {
					faction = this.cacheFaction(reference.uri, Promise.resolve(reference.view));
				} else {
					faction = this.faction(reference.uri);
				}

				yield faction;
			}
			if (factions.next) {
				factions = await this.http.get(factions.next)
					.then(j => FactionsPage.parse(j));
			} else {
				break;
			}
		}
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