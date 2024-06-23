<style>
</style>
<script lang="ts">
    import type { Authentication } from "../lib/authentication";

	export let auth: Authentication;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";
</script>
{#if loggedIn}
	<button on:click="{() => auth.logout()}">Logout</button>
{:else}
	<button on:click="{() => auth.generateLoginUrl().then(url => document.location.href = url.href)}">
		Login
	</button>
{/if}