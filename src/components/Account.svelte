<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { Authentication } from "../lib/authentication";
	import type { User as UserData } from "../lib/user";
	import Login from "./Login.svelte";
	import CurrentUser from "./CurrentUser.svelte";
	import type { Site } from "../lib/site";

	export let site: Site;
	export let auth: Authentication;
	export let user: Readable<Promise<UserData> | undefined>;
	export let access: Set<string>;
</script>
<style>
	h2 {
		font-size: medium;
		margin: 0;
	}

	h3 {
		font-size: xx-large;
		margin: 0;
	}
</style>
<div class="flex space align-middle">
	<h2>Account</h2>
	<Login {auth} />
</div>
{#await $user}
	<h3>Loading User Data</h3>
{:then user}
	{#if typeof user === "undefined"}
		Unexpected missing user data
	{:else}
		<CurrentUser {user} {access} />
		<!-- TODO: stats -->
	{/if}
{/await}
