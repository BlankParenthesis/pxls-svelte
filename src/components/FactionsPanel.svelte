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
<h2>Factions</h2>
{#await $user}
	<p>Loading</p>
{:then user}
	{#if typeof user !== "undefined"}
		<FactionsList factions={user.factions()} {access} />
	{/if}
	{#if access.has("factions.list")}
		<FactionsSearch {site} {access} />
	{/if}
{/await}
