<script lang="ts">
    import type { User } from "../lib/user";
    import Faction from "./Faction.svelte";

	export let user: User;

	const factions = user.factions();
</script>
<style>
	h4 {
		font-size: small;
		margin: 0;
	}
</style>
<section class="factions">
	<h4>Factions</h4>
	{#await $factions}
		<p>Loading Factions</p>
	{:then factions}
		<ul class="roles flex wrap">
			{#each factions as faction}
				<Faction {faction} />
			{/each}
		</ul>
	{/await}
</section>
