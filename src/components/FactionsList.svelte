<script lang="ts">
	import FactionDisplay from "./Faction.svelte";
	import Unwrap from "./Unwrap.svelte";
	import { CurrentFaction } from "../lib/user";

	export let factions: Array<CurrentFaction>;
	export let access: Set<string>;
</script>
<ul class="item-list">
	{#each factions as faction}
		<Unwrap store={faction.faction.fetch()} let:value>
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
