import { type Readable, get } from "svelte/store";
import { resolveURL } from "./util";

// TODO: rename
export class Requester {
	constructor(
		public readonly baseURL: URL,
		private readonly token: Readable<string | undefined>,
	) {}

	private headers(): HeadersInit {
		const token = get(this.token);
		if (typeof token !== "undefined") {
			return { authorization: `Bearer ${token}` };
		} else {
			return {};
		}
	}

	public getRaw(location?: string): Promise<Response> {
		const headers = this.headers();
		let url: URL;
		if (typeof location === "undefined") {
			url = this.baseURL;
		} else {
			url = resolveURL(this.baseURL, location);
		}
		return fetch(url, { headers });
	}

	public get(location?: string): Promise<unknown | undefined> {
		return this.getRaw(location).then(r => {
			if (r.status === 404) {
				return undefined;
			} else {
				return r.json();
			}
		});
	}

	public post(data: Record<string, unknown>, location?: string): Promise<{ uri: string, view: unknown }> {
		const headers = this.headers() as Record<string, string>;
		headers["content-type"] = "application/json";
		let url: URL;
		if (typeof location === "undefined") {
			url = this.baseURL;
		} else {
			url = resolveURL(this.baseURL, location);
		}
		return fetch(url, { method: "post", headers, body: JSON.stringify(data) })
			.then(async r => {
				const uri = r.headers.get("location");
				if (uri === null) {
					throw new Error("invalid post response (missing location)");
				}
				const view = await r.json() as unknown;
				return { uri, view };
			});
	}

	public delete(location?: string) {
		const headers = this.headers();
		let url: URL;
		if (typeof location === "undefined") {
			url = this.baseURL;
		} else {
			url = resolveURL(this.baseURL, location);
		}
		return fetch(url, { method: "delete", headers });
	}

	public data(start: number, end: number): Promise<ArrayBuffer> {
		const range = "bytes=" + start + "-" + end;
		const headers = { "Range":  range, ...this.headers() };
		return fetch(this.baseURL, { headers }).then(r => r.arrayBuffer());
	}

	public async socket(location: string, events: Array<string>): Promise<WebSocket> {
		const token = get(this.token);
		const query = events
			.map(e => "subscribe[]=" + encodeURIComponent(e));

		if (typeof token !== "undefined") {
			query.push("authenticate=true");
		}

		const url = resolveURL(this.baseURL, location + "?" + query.join("&"));
		const socket = new WebSocket(url);
		await new Promise((resolve, reject) => {
			let unsubscribe = () => {};
			socket.onclose = () => {
				unsubscribe();
				reject(new Error("Socket closed"));
			};
			socket.onerror = () => reject(new Error("Socket error"));
			
			if (typeof token !== "undefined") {
				socket.onopen = () => {
					unsubscribe = this.token.subscribe(token => {
						socket.send(JSON.stringify({
							"type": "authenticate",
							"token": token,
						}));
					});
				};
			}
			socket.onmessage = m => {
				try {
					const packet = JSON.parse(m.data);
					if (packet.type === "ready") {
						resolve(null);
					} else {
						throw new Error("Unexpected packet");
					}
				} catch (e) {
					reject(e);
				}
			};
		});
		return socket;
	}

	public subpath(location: string): Requester {
		const newURL = resolveURL(this.baseURL, location);
		return new Requester(newURL, this.token);
	}
}