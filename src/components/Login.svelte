<script lang="ts">
	import type { Authentication } from "../lib/authentication";

	export let auth: Authentication;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";

	async function login() {
		const url = await auth.generateLoginUrl();
		document.location.href = url.href;
	}
</script>
<style>
</style>
{#if loggedIn}
	<button class="button" on:click="{() => auth.logout()}">Logout</button>
{:else}
	<button class="button" on:click="{login}">Login</button>
{/if}
