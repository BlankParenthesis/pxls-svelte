<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { Faction } from "../lib/faction";
	import Time from "./Time.svelte";
	import FactionStatus from "./FactionStatus.svelte";

	export let faction: Readable<Promise<Faction> | undefined>;
	export let access: Set<string>;
</script>
<style>
	h5 {
		font-size: medium;
		margin: 0;
	}
</style>
<li class="faction">
	{#await $faction}
		Loading Faction
	{:then faction}
		{#if typeof faction !== "undefined"}
			<div class="flex space">
				<h5>{faction.name}</h5>
				{#if access.has("factions.members.get")}
					{#await faction.currentMember()}
						<span>Loading Faction Members</span>
					{:then member}
						<FactionStatus {faction} {member} {access} />
					{/await}
				{/if}
			</div>
			<div class="flex space gap">
				<span class="no-shrink">
					Created <Time time={faction.createdAt} />
				</span>
				<span class="no-shrink">
					{faction.size} Members
				</span>
			</div>
		{/if}
	{/await}
</li>
