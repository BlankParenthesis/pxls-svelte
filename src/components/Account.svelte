<script lang="ts">
	import type { Authentication } from "../lib/authentication";
	import Login from "./Login.svelte";
	import CurrentUser from "./CurrentUser.svelte";
	import Unwrap from "./Unwrap.svelte";
	import type { Site } from "../lib/site";

	export let site: Site;
	export let auth: Authentication;
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
<Unwrap store={site.currentUser()} let:value>
	{#await value}
		<p>Loading</p>
	{:then userReference}
		<Unwrap store={userReference.fetch()} let:value>
			{#await value}
				<p>Loading User Data</p>
			{:then user}
				{#if typeof user === "undefined"}
					<p>Unexpected missing user data</p>
				{:else}
					<CurrentUser {user} {access}/>
				{/if}
			{/await}
		</Unwrap>
	{/await}
</Unwrap>
