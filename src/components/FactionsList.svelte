<script lang="ts">
	import { type Readable } from "svelte/store";
	import FactionDisplay from "./Faction.svelte";
	import { Faction } from "../lib/faction";

	export let factions: Readable<Promise<Readable<Promise<Faction> | undefined>[]>>;
	export let access: Set<string>;
</script>
{#await $factions}
	<p>Loading Factions</p>
{:then factions}
	<ul class="item-list">
		{#each factions as faction}
			<li><FactionDisplay {faction} {access} /></li>
		{:else}
			<small class="empty-placeholder">Not in any faction</small>
		{/each}
	</ul>
{/await}
