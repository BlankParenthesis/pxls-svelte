<script lang="ts">
	import { type Readable } from "svelte/store";
	import { Faction } from "../lib/faction";
	import FactionDisplay from "./Faction.svelte";
	import Unwrap from "./Unwrap.svelte";

	export let factions: Array<Readable<Promise<Faction> | undefined>>;
	export let access: Set<string>;
</script>
<ul class="item-list">
	{#each factions as faction}
		<Unwrap store={faction} let:value>
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
