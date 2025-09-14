<script lang="ts">
	import FactionDisplay from "./Faction.svelte";
	import type { Faction } from "../lib/faction";
	import type { Reference } from "../lib/reference";
	import Unwrap from "./Unwrap.svelte";

	export let factions: Array<Reference<Faction>>;
	export let access: Set<string>;
</script>
<ul class="item-list">
	{#each factions as faction}
		<Unwrap store={faction.fetch()} let:value>
			{#await value}
				<li>Loading Faction…</li>
			{:then faction}
				{#if typeof faction !== "undefined"}
					<li><FactionDisplay {faction} {access} /></li>
				{/if}
			{/await}
		</Unwrap>
	{:else}
		<small class="empty-placeholder">Not in any faction</small>
	{/each}
</ul>
