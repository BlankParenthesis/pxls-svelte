<script lang="ts">
	import { type Readable } from "svelte/store";
	import { User } from "../lib/user";
	import { Site } from "../lib/site";
	import FactionsList from "./FactionsList.svelte";
	import FactionsSearch from "./FactionsSearch.svelte";

	export let access: Set<string>;
	export let user: Readable<Promise<User> | undefined>;
	export let site: Site;
</script>
<style>
</style>
<h2>Factions</h2>
{#await $user}
	<p>Loading</p>
{:then user}
	{#if typeof user !== "undefined"}
		<section>
			<h3>Your Factions</h3>
			<FactionsList factions={user.factions()} {access} />
		</section>
	{/if}
	{#if access.has("factions.list")}
		<section>
			<h3>Available Factions</h3>
			<FactionsSearch {site} {access} />
		</section>
	{/if}
{/await}
