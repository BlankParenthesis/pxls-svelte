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
	<ul class="flex wrap">
		{#each factions as faction}
			<FactionDisplay {faction} {access} />
		{:else}
			<small>Not in any faction</small>
		{/each}
	</ul>
{/await}
