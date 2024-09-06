<script lang="ts">
    import type { Site } from "../lib/site";
    import type { User } from "../lib/user";
    import { debounce } from "../lib/util";
    import Faction from "./Faction.svelte";
    import LazyList from "./LazyList.svelte";

	export let site: Site;
	export let user: User;
	export let access: Set<string>;
	let search = "";
	// this is a silly type dance we have to do, not sure why
	type HTMLInputEventSvelte = Event & { currentTarget: EventTarget & HTMLInputElement };
	type HTMLInputEvent = Event & { target: EventTarget & HTMLInputElement };
	const updateSearch = debounce((e: HTMLInputEventSvelte) => {
		search = (e as unknown as HTMLInputEvent).target.value;
	});

	const userFactions = user.factions();
</script>
<style>
	h4 {
		font-size: small;
		margin: 0;
	}
</style>
<section class="factions">
	<h4>Factions</h4>
	{#await $userFactions}
		<p>Loading Factions</p>
	{:then factions}
		<ul class="flex wrap">
			{#each factions as faction}
				<Faction {faction} />
			{:else}
				No Factions Joined
			{/each}
		</ul>
	{/await}
	{#if access.has("factions.list")}
		<label class="fullwidth">
			<span class="inline-label">Factions Search: {search}</span>
			<input type="text" class="fullwidth" on:input={updateSearch} />
		</label>
		<LazyList itemSource={site.searchFactions(search)} let:item={faction}>
			<Faction {faction} />
		</LazyList>
	{/if}
</section>
