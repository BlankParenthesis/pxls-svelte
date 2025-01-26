<script lang="ts">
	import { Site } from "../lib/site";
	import { debounce } from "../lib/util";
	import FactionDisplay from "./Faction.svelte";
	import LazyList from "./LazyList.svelte";
	import Unwrap from "./Unwrap.svelte";

	export let access: Set<string>;
	export let site: Site;

	let search = "";
	// this is a silly type dance we have to do, not sure why
	type HTMLInputEventSvelte = Event & { currentTarget: EventTarget & HTMLInputElement };
	type HTMLInputEvent = Event & { target: EventTarget & HTMLInputElement };
	const updateSearch = debounce((e: HTMLInputEventSvelte) => {
		search = (e as unknown as HTMLInputEvent).target.value;
	});

</script>
<style>
</style>
<label class="fullwidth flex wrap gap search">
	<span>🔍&#xFE0E;</span>
	<input type="text" class="grow" placeholder="Search Factions" on:input={updateSearch} />
</label>
<LazyList itemSource={site.searchFactions(search)} let:item={faction}>
	<Unwrap store={faction} let:value>
		{#await value}
			<li>Loading Faction…</li>
		{:then faction}
			{#if typeof faction !== "undefined"}
				<li><FactionDisplay {faction} {access} /></li>
			{/if}
		{/await}
	</Unwrap>
	<p slot="empty"><small class="empty-placeholder">No factions</small></p>
</LazyList>
