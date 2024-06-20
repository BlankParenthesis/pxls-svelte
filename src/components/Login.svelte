<style>
</style>
<script lang="ts">
	import { randomString } from "../lib/util";
	import { sha256 } from "js-sha256";

	const state = randomString();
	const challengeRaw = randomString();
	const challenge = sha256(challengeRaw);
	const domain = "http://localhost:8080";
	const realm = "pxls";
	const client = "pxls";
	const location = `${domain}/realms/${realm}/protocol/openid-connect/auth`;
	const params = {
		"response_mode": "fragment",
		"response_type": "code",
		"state": state,
		"code_challenge": challenge,
		"code_challenge_method": "S256",
		"client_id": client,
		"redirect_uri": document.location.origin + document.location.pathname,
	};
	const query = Object.entries(params)
		.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
		.join("&");
	const loginUrl = new URL(`${location}?${query}`)
</script>
<button on:click="{() => document.location.href = loginUrl.href}">Login</button>