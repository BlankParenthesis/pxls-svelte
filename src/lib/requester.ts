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
			return { authentication: `Bearer ${token}` };
		} else {
			return {};
		}
	}

	public get(location?: string): Promise<unknown> {
		const headers = this.headers();
		let url: URL;
		if (typeof location === "undefined") {
			url = this.baseURL;
		} else {
			url = resolveURL(this.baseURL, location);
		}
		return fetch(url, { headers }).then(r => r.json());
	}

	public data(start: number, end: number): Promise<ArrayBuffer> {
		const range = "bytes=" + start + "-" + end;
		const headers = { "Range":  range, ...this.headers() };
		return fetch(this.baseURL, { headers }).then(r => r.arrayBuffer());
	}

	public subpath(location: string): Requester {
		const newURL = resolveURL(this.baseURL, location);
		return new Requester(newURL, this.token);
	}
}