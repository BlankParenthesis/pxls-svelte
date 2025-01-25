/**
 * A wrapper around Image which will automatically use a cors proxy when needed.
 */
export class SafeImage {
	public readonly image = new Image();
	private errorCallback = () => undefined as unknown;
	private source: string | undefined;

	constructor(
		private readonly corsBase: string = import.meta.env.VITE_CORS_SITE,
		private readonly corsParam: string | undefined = import.meta.env.VITE_CORS_PARAM,
	) {
		this.corsBase = this.corsBase.replaceAll(/\/*$/g, "");

		if (typeof import.meta.env.VITE_CORS_SITE === "undefined") {
			throw new Error("Missing base url for cors proxy");
		}
		this.image.crossOrigin = "anonymous";
	}

	proxy(url: string): string {
		if (typeof this.corsParam === "undefined") {
			return `${this.corsBase}/${url}`;
		} else {
			const encodedUrl = encodeURIComponent(url);
			return `${this.corsBase}?${this.corsParam}=${encodedUrl}`;
		}
	}

	get src() {
		return this.source;
	}

	set src(url: string | undefined) {
		if (typeof url === "undefined") {
			this.image.removeAttribute("src");
		} else {
			this.image.onerror = () => {
				this.image.onerror = this.errorCallback;
				this.image.src = this.proxy(url);
			};
			this.image.src = url;
			this.source = url;
		}
	}

	set onload(callback: () => unknown) {
		this.image.onload = callback;
	}

	set onerror(callback: () => unknown) {
		this.errorCallback = callback;
	}

	get width() {
		return this.image.width;
	}

	get height() {
		return this.image.height;
	}
}
