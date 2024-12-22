import { z } from "zod";
import { base64urlsafe, getFragment, randomString, resolveURL, setFragment } from "./util";
import { derived, get, type Readable } from "svelte/store";
import { persistentWritable, type PersistentWritable } from "./storage/persistent";

/* eslint-disable camelcase */
export const SiteAuthUnverified = z.object({
	issuer: z.string(),
	client_id: z.string().optional(),
});
export type SiteAuthUnverified = z.infer<typeof SiteAuthUnverified>;
type SiteAuth = {
	issuer: string;
	client_id: string;
};

const OpenIDConfig = z.object({
	issuer: z.string(),
	authorization_endpoint: z.string(),
	token_endpoint: z.string(),
	userinfo_endpoint: z.string().optional(),
	jwks_uri: z.string(),
	registration_endpoint: z.string().optional(),
	scopes_supported: z.array(z.string()).optional(),
	response_types_supported: z.array(z.string()),
	response_modes_supported: z.array(z.string()).optional(),
	grant_types_supported: z.array(z.string()).optional(),
	acr_values_supported: z.array(z.string()).optional(),
	subject_types_supported: z.array(z.string()),
	id_token_signing_alg_values_supported: z.array(z.string()),
	id_token_encryption_alg_values_supported: z.array(z.string()).optional(),
	id_token_encryption_enc_values_supported: z.array(z.string()).optional(),
	userinfo_signing_alg_values_supported: z.array(z.string()).optional(),
	userinfo_encryption_alg_values_supported: z.array(z.string()).optional(),
	userinfo_encryption_enc_values_supported: z.array(z.string()).optional(),
	request_object_signing_alg_values_supported: z.array(z.string()).optional(),
	request_object_encryption_alg_values_supported: z.array(z.string()).optional(),
	request_object_encryption_enc_values_supported: z.array(z.string()).optional(),
	token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
	token_endpoint_auth_signing_alg_values_supported: z.array(z.string()).optional(),
	display_values_supported: z.array(z.string()).optional(),
	claim_types_supported: z.array(z.string()).optional(),
	claims_supported: z.array(z.string()).optional(),
	service_documentation: z.string().optional(),
	claims_locales_supported: z.array(z.string()).optional(),
	ui_locales_supported: z.array(z.string()).optional(),
	claims_parameter_supported: z.boolean().optional(),
	request_parameter_supported: z.boolean().optional(),
	request_uri_parameter_supported: z.boolean().optional(),
	require_request_uri_registration: z.boolean().optional(),
	op_policy_uri: z.string().optional(),
	op_tos_uri: z.string().optional(),
	end_session_endpoint: z.string().optional(),
});
type OpenIDConfig = z.infer<typeof OpenIDConfig>;

const StateStorage = z.object({
	state: z.string(),
	challenge: z.string(),
});
type StateStorage = z.infer<typeof StateStorage>;

const FragmentLogin = z.object({
	state: z.string(),
	session_state: z.string(),
	iss: z.string(),
	code: z.string(),
});
type FragmentLogin = z.infer<typeof FragmentLogin>;

const FragmentError = z.object({
	state: z.string(),
	error: z.string(),
	error_description: z.string().optional(),
	error_uri: z.string().optional(),
	iss: z.string().optional(),
});
type FragmentError = z.infer<typeof FragmentError>;

const FragmentState = FragmentLogin
	.or(FragmentError)
	.or(z.object({}).transform(() => undefined));
type FragmentState = z.infer<typeof FragmentState>;

const TokenStorage = z.object({
	token: z.string(),
	expiry: z.number(),
	refresh_token: z.string().optional(),
});
type TokenStorage = z.infer<typeof TokenStorage>;

const Token = z.object({
	access_token: z.string(),
	token_type: z.string(),
	expires_in: z.number().optional(),
	refresh_token: z.string().optional(),
	id_token: z.string(),
});
type Token = z.infer<typeof Token>;
/* eslint-enable camelcase */

export class Authentication {
	private static takeReturnedFragment(): FragmentState {
		const fragment = getFragment();
		const state = FragmentState.parse(fragment);
		// clean up the url
		for (const key in state) {
			delete fragment[key];
		}
		setFragment(fragment);
		return state;
	}

	static async login(config: SiteAuthUnverified): Promise<Authentication> {
		if (!config.client_id) {
			// Realistically we'd need a server component to support this.
			// (Or accept leaking secrets publicly, which works for some 🤷)
			throw new Error("private login unsupported");
		}

		const wellKnown = resolveURL(new URL(config.issuer), ".well-known/openid-configuration");
		const openid = await fetch(wellKnown)
			.then(r => r.json())
			.then(j => OpenIDConfig.parse(j));

		const responseModes = openid.response_modes_supported;
		if (typeof responseModes !== "undefined" && !responseModes.includes("fragment")) {
			// this is needed because query would leak secrets to the client host
			throw new Error("Fragment authentication response not supported");
		}

		const tokenStore = persistentWritable("token", TokenStorage.parse);
		const defaultState = { state: "", challenge: "" };
		const stateStore = persistentWritable("loginstate", StateStorage.parse, defaultState);

		const authentication = new Authentication(
			config as SiteAuth,
			openid,
			tokenStore,
			stateStore,
		);

		const login = Authentication.takeReturnedFragment();
		if (typeof login === "undefined") {
			const token = get(tokenStore);
			if (typeof token !== "undefined" && token.expiry <= Date.now()) {
				if (typeof token.refresh_token === "undefined") {
					tokenStore.reset();
				} else {
					try {
						tokenStore.set(await authentication.refreshToken(token.refresh_token));
					} catch (e) {
						console.warn("Unable to use refresh token", e);
						tokenStore.reset();
					}
				}
			}
		} else {
			if ("error" in login) {
				throw new Error("TODO: store the error");
			} else {
				tokenStore.set(await authentication.fetchToken(login));
			}
		}

		let tokenRefresh: number | undefined;
		let cancelationNumber = 0;

		tokenStore.subscribe((token) => {
			if (typeof token !== "undefined") {
				// milliseconds until 30s before token expires
				const wait = token.expiry - Date.now() - 30000;

				if (wait < 0) {
					// this shouldn't happen, but it does
					console.warn("token already expired");
				}

				clearTimeout(tokenRefresh);

				if (typeof token.refresh_token !== "undefined") {
					tokenRefresh = setTimeout(async () => {
						cancelationNumber += 1;
						const localCancel = cancelationNumber;
						try {
							const newToken = await authentication.refreshToken(token.refresh_token as string);
							// account for token being set between requesting and recieving the new token
							if (localCancel !== cancelationNumber) {
								return;
							}
							tokenStore.set(newToken);
						} catch (_) {
							tokenStore.reset();
						}
					}, wait);
				} else {
					// if we have no refresh token, just invalidate the store
					tokenRefresh = setTimeout(() => tokenStore.reset(), wait + 29999);
				}
			}
		});

		return authentication;
	}

	public readonly token: Readable<string | undefined>;
	constructor(
		private readonly config: SiteAuth,
		private readonly openid: OpenIDConfig,
		private readonly tokenStore: PersistentWritable<TokenStorage | undefined>,
		private readonly stateStore: PersistentWritable<StateStorage>,
	) {
		this.token = derived(tokenStore, t => t?.token);
	}

	private tokenFetchSettings(params: Record<string, string>): RequestInit {
		return {
			method: "post",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: Object.entries({
				"client_id": this.config.client_id,
				"redirect_uri": document.location.origin + document.location.pathname,
				...params,
			}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"),
		};
	}

	private async refreshToken(refreshToken: string): Promise<TokenStorage> {
		const settings = this.tokenFetchSettings({
			"grant_type": "refresh_token",
			"refresh_token": refreshToken,
		});

		const token = await fetch(this.openid.token_endpoint, settings)
			.then(r => r.json())
			.then(j => Token.parse(j));

		if (!token.expires_in) {
			throw new Error("TODO: read expiry from jwt data");
		}

		/* eslint-disable camelcase */
		return {
			token: token.access_token,
			refresh_token: token.refresh_token,
			expiry: Date.now() + token.expires_in * 1000,
		};
		/* eslint-enable camelcase */
	}

	private async fetchToken(login: FragmentLogin): Promise<TokenStorage> {
		const { state, challenge } = get(this.stateStore);
		if (state !== state) {
			throw new Error("Login state mismatch");
		}
		const settings = this.tokenFetchSettings({
			"grant_type": "authorization_code",
			"code": login.code,
			"code_verifier": challenge,
		});

		const token = await fetch(this.openid.token_endpoint, settings)
			.then(r => r.json())
			.then(j => Token.parse(j));

		if (!token.expires_in) {
			throw new Error("TODO: read expiry from jwt data");
		}

		/* eslint-disable camelcase */
		return {
			token: token.access_token,
			refresh_token: token.refresh_token,
			expiry: Date.now() + token.expires_in * 1000,
		};
		/* eslint-enable camelcase */
	}

	private static async encodeChallenge(challenge: string) {
		const stringbuffer = new TextEncoder().encode(challenge);
		const sha256 = await crypto.subtle.digest("SHA-256", stringbuffer);
		const bytes = new Uint8Array(sha256);
		return base64urlsafe(bytes);
	}

	private static async challengeParams(challenge: string) {
		if (Object.prototype.hasOwnProperty.call(crypto, "subtle")) {
			return {
				"code_challenge_method": "S256",
				"code_challenge": await Authentication.encodeChallenge(challenge),
			};
		} else {
			return {
				"code_challenge_method": "plain",
				"code_challenge": challenge,
			};
		}
	}

	public async generateLoginUrl(): Promise<URL> {
		const state: StateStorage = {
			challenge: randomString(64),
			state: randomString(),
		};

		this.stateStore.set(state);

		const location = this.openid.authorization_endpoint;
		// TODO: if we have an old token, we can pass that as id_token_hint and
		// set prompt = none to possibly bypass authentication.
		const params = {
			"scope": "openid",
			"response_mode": "fragment",
			"response_type": "code",
			"state": state.state,
			"client_id": this.config.client_id,
			"prompt": "consent",
			"redirect_uri": document.location.origin + document.location.pathname,
			...await Authentication.challengeParams(state.challenge),
		};
		const query = Object.entries(params)
			.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
			.join("&");

		return new URL(`${location}?${query}`);
	}

	public async logout() {
		this.tokenStore.reset();
		const newURL = this.openid.end_session_endpoint || document.location.href;

		document.location.href = newURL;
	}
}
