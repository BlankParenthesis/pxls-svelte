<script lang="ts">
	import { Site } from "../lib/site";
	import { debounce } from "../lib/util";
	import FactionItem from "./FactionItem.svelte";
	import LazyList from "./LazyList.svelte";

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
	<FactionItem {faction} {access} />
	<p slot="empty"><small class="empty-placeholder">No factions</small></p>
</LazyList>
