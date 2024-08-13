<script lang="ts">
    import type { Readable } from "svelte/motion";
    import type { Faction } from "../lib/faction";

	export let faction: Readable<Promise<Faction>>;
</script>
<style>
	h5 {
		font-size: medium;
		margin: 0;
	}
</style>
<li class="faction">
	{#await $faction}
		Loading Role
	{:then faction}
		<div>
			<h5>{faction.name}</h5>
			<!-- TODO: member status badge (owner, joined, invited, requested) -->
		</div>
		<div class="flex space gap">
			<span class="no-shrink">
				{faction.size} Members
			</span>
			<span class="no-shrink">
				Created <time datetime={faction.created_at.toISOString()}>{faction.created_at.toLocaleDateString()}</time>
			</span>
		</div>
	{/await}
</li>