<script lang="ts" context="module">
	// global variable to track if the page wants to navigate away
	// this is currently needed because navigating will disconnect the sockets,
	// triggering a page reload.
	// Possibly one of the ugliest hacks here, but the reload trick for socket
	// disconnect is a close second and both should get cleared up at the same
	// time so 🤷.
	export const navigationState = { navigating: false };
</script>
<script lang="ts">
    import type { Authentication } from "../lib/authentication";

	export let auth: Authentication;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";

	async function login() {
		const url = await auth.generateLoginUrl();
		navigationState.navigating = true;
		document.location.href = url.href;
	}
</script>
<style>
</style>
{#if loggedIn}
	<button on:click="{() => auth.logout()}">Logout</button>
{:else}
	<button on:click="{login}">
		Login
	</button>
{/if}