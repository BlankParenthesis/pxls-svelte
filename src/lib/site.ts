import { z } from "zod";

import { Extension } from "./extensions";
import { Permissions } from "./permissions";
import { BoardInfo } from "./board/info";
import { resolveURL, type Parser } from "./util";
import { SiteAuthUnverified, Authentication } from "./authentication";
import { Requester } from "./requester";
import { CurrentFaction, User } from "./user";
import { Role } from "./role";
import { parser as eventsParser } from "./events";
import { get, writable, type Readable, type Writable } from "svelte/store";
import { Faction } from "./faction";
import { FactionMember } from "./factionmember";
import { Cache, CacheOnce } from "./cache";
import { Page } from "./page";
import { Reference } from "./reference";
import { Board } from "./board/board";
import { navigationState } from "../components/Login.svelte";

const SiteInfo = z.object({
	name: z.string().nullable().optional(),
	version: z.string().nullable().optional(),
	source: z.string().nullable().optional(),
	extensions: z.array(Extension).transform(e => new Set(e)),
});
export type SiteInfo = z.infer<typeof SiteInfo>;

export class Site {
	static async connect(location: URL): Promise<Site> {
		const clockDelta = writable(0);
		let delta = 0;
		clockDelta.subscribe(v => delta = v);
		const parseTime = (time: number) => new Date(time * 1000 + delta);
		const info: SiteInfo = await fetch(resolveURL(location, "info"))
			.then((r) => {
				if (r.status === 403) {
					console.warn("No info access, presuming no extensions");
					return { extensions: [] };
				} else {
					const dateHeader = r.headers.get("date");
					if (dateHeader !== null) {
						const serverTime = new Date(dateHeader);
						clockDelta.set(Date.now() - serverTime.getTime());
					} else {
						console.error("Unable to compute time delta with server");
					}
					return r.json();
				}
			})
			.then(j => SiteInfo.parse(j));

		if (!info.extensions.has("authentication")) {
			throw new Error("TODO: anonymous canvas");
		}

		const auth = await fetch(resolveURL(location, "auth"))
			.then(r => r.json())
			.then(j => SiteAuthUnverified.parse(j))
			.then(a => Authentication.login(a));

		const http = new Requester(location, auth.token);
		const access = await http.get("access")
			.then(j => Permissions.parse(j));

		const events = [];

		if (info.extensions.has("users")) {
			if (access.has("events.users.current")) {
				events.push("users.current");

				if (access.has("events.users.current.roles")) {
					events.push("users.current.roles");
				}
			}
		}

		if (info.extensions.has("factions")) {
			if (access.has("events.factions.current")) {
				events.push("factions.current");

				if (access.has("events.factions.current.members")) {
					events.push("factions.current.members");
				}
			}
		}

		let socket;
		if (events.length !== 0) {
			socket = await http.socket("events", events);
		}

		return new Site(http, info, auth, clockDelta, parseTime, socket);
	}

	readonly parsers: {
		faction: Parser<Faction>;
		factionReference: Parser<Reference<Faction>>;
		factionsPage: Parser<Page<Reference<Faction>>>;
		user: Parser<User>;
		userReference: Parser<Reference<User>>;
		usersPage: Parser<Page<Reference<User>>>;
		role: Parser<Role>;
		roleReference: Parser<Reference<Role>>;
		rolesPage: Parser<Page<Reference<Role>>>;
		factionMember: Parser<FactionMember>;
		factionMemberReference: Parser<Reference<FactionMember>>;
		factionMembersPage: Parser<Page<Reference<FactionMember>>>;
		board: Parser<BoardInfo>;
		boardReference: Parser<Reference<BoardInfo>>;
		boardsPage: Parser<Page<Reference<BoardInfo>>>;
		currentFaction: Parser<CurrentFaction>;
		currentFactionsPage: Parser<Page<CurrentFaction>>;
	};

	private constructor(
		private readonly http: Requester,
		public readonly info: SiteInfo,
		public readonly auth: Authentication,
		private readonly clockDelta: Writable<number>,
		public readonly parseTime: (time: number) => Date,
		private readonly socket?: WebSocket,
	) {
		// parsers
		{
			const faction = Faction.parser(this, this.parseTime);
			const factionReference = Reference.parser(this.factions, faction);
			const factionsPage = Page.parser(factionReference);

			const user = User.parser(this, this.parseTime);
			const userReference = Reference.parser(this.users, user);
			const usersPage = Page.parser(userReference);

			const role = Role.parser();
			const roleReference = Reference.parser(this.roles, role);
			const rolesPage = Page.parser(roleReference);

			const factionMember = FactionMember.parser(userReference);
			const factionMemberReference = Reference.parser(this.factionMembers, factionMember);
			const factionMembersPage = Page.parser(factionMemberReference);

			const board = BoardInfo.parser(parseTime);
			const boardReference = Reference.parser(this.boardInfos, board);
			const boardsPage = Page.parser(boardReference);

			const currentFaction = CurrentFaction(factionReference, factionMemberReference);
			const currentFactionsPage = Page.parser(currentFaction);

			this.parsers = {
				faction,
				factionReference,
				factionsPage,
				user,
				userReference,
				usersPage,
				role,
				roleReference,
				rolesPage,
				factionMember,
				factionMemberReference,
				factionMembersPage,
				board,
				boardReference,
				boardsPage,
				currentFaction,
				currentFactionsPage,
			};
		}

		const parseEvent = eventsParser(this.http, this.parsers);

		socket?.addEventListener("message", (e) => {
			try {
				const packet = parseEvent(JSON.parse(e.data) as unknown);
				switch (packet.type) {
					case "user-updated":
						packet.user.fetch();
						break;
					case "user-roles-updated":
						get(this.users.fetch(packet.user))?.then((u) => {
							u.updateRoles();
							return u;
						});
						break;
					case "faction-created":
						break;
					case "faction-updated":
						packet.faction.fetch();
						break;
					case "faction-deleted":
						this.factions.delete(packet.faction);
						this.factionMembers.delete(packet.faction + "members/current");
						get(this.currentUser()).then(async (currentUser) => {
							if (typeof currentUser === "undefined") {
								return;
							}
							const user = await get(currentUser.fetch());
							if (typeof user === "undefined") {
								return;
							}
							const factions = await get(user.factions());
							if (factions.some(f => f.faction.uri === packet.faction)) {
								user.updatefactions();
							}
						});
						break;
					case "faction-member-updated":
						// Mark the faction current member if the faction
						// doesn't have it set.
						Promise.all([
							get(packet.member.fetch()),
							get(packet.faction.fetch()),
							get(this.currentUser()),
						]).then(([member, faction, currentUser]) => {
							if (typeof currentUser !== "undefined") {
								if (member?.user?.uri === currentUser.uri) {
									faction?.setCurrentMember(packet.member);
									get(currentUser.get())?.then((u) => {
										u.updatefactions();
									});
								}
							}
						});

						break;
				}
			} catch (e) {
				console.error("Failed to parse packet", e);
			}
		});

		socket?.addEventListener("close", () => {
			// TODO: proper state handling to recover from this
			// for now, just do as pxls: reload the page.
			if (!navigationState.navigating) {
				document.location.reload();
			}
		});
	}

	readonly users = new Cache((location: string) => {
		const http = this.http.subpath(location);
		const parse = this.parsers.user(http).parse;
		return this.http.get(location).then(parse);
	});

	readonly roles = new Cache((location: string) => {
		const http = this.http.subpath(location);
		const parse = this.parsers.role(http).parse;
		return this.http.get(location).then(parse);
	});

	readonly factions = new Cache((location) => {
		const http = this.http.subpath(location);
		const parse = this.parsers.faction(http).parse;
		return this.http.get(location).then(parse);
	});

	readonly factionMembers = new Cache((location) => {
		const http = this.http.subpath(location);
		const parse = this.parsers.factionMember(http).parse;
		// TODO: default on 404
		return this.http.get(location).then(parse);
	});

	async *searchFactions(name: string) {
		const query = "?name=" + encodeURIComponent("*" + name + "*");
		// TODO: check permissions
		const parse = this.parsers.factionsPage(this.http).parse;
		let factions = await this.http.get("factions" + query).then(parse);
		while (true) {
			for (const reference of factions.items) {
				yield reference.fetch();
			}
			if (factions.next) {
				factions = await this.http.get(factions.next).then(parse);
			} else {
				break;
			}
		}
	}

	createFaction(faction: { name: string }): Promise<Reference<Faction>> {
		const http = this.http.subpath("factions");
		const parse = this.parsers.factionReference(http).parse;
		return http.post(faction).then(parse);
	}

	// TODO: invalidate on auth change
	private currentUserCache?: Writable<Promise<Reference<User>>>;
	currentUser(): Readable<Promise<Reference<User>>> {
		if (typeof this.currentUserCache === "undefined") {
			const parse = this.parsers.userReference(this.http).parse;
			// TODO: handle 404
			const reference = this.http.get("users/current").then(parse);
			this.currentUserCache = writable(reference);
		}

		return this.currentUserCache;
	}

	private accessCache?: Writable<Promise<Permissions>>;
	access(): Readable<Promise<Permissions>> {
		if (typeof this.accessCache === "undefined") {
			const access = this.http.get("access")
				.then(j => Permissions.parse(j));

			this.accessCache = writable(access);
		}

		return this.accessCache;
	}

	// TODO: this is not kept in sync with boards' local copies
	readonly boardInfos = new Cache((location) => {
		const http = this.http.subpath(location);
		const parse = this.parsers.board(http).parse;
		return this.http.get(location).then(parse);
	});

	readonly boards = new CacheOnce((location) => {
		return Board.connect(this, this.http.subpath(location));
	});

	async *fetchBoards() {
		const parse = this.parsers.boardsPage(this.http).parse;
		let boards = await this.http.get("boards").then(parse);
		while (true) {
			for (const reference of boards.items) {
				yield reference;
			}
			if (boards.next) {
				boards = await this.http.get(boards.next).then(parse);
			} else {
				break;
			}
		}
	}

	async defaultBoard(): Promise<Reference<BoardInfo>> {
		const parse = this.parsers.boardReference(this.http).parse;
		return await this.http.get("boards/default").then(parse);
	}
}
