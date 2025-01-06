<script lang="ts">
	import { Site } from "../lib/site";
	import { debounce } from "../lib/util";
	import Faction from "./Faction.svelte";
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
<label class="fullwidth">
	<span class="inline-label">Factions Search: {search}</span>
	<input type="text" class="fullwidth" on:input={updateSearch} />
</label>
<LazyList itemSource={site.searchFactions(search)} let:item={faction}>
	<Faction {faction} {access} />
</LazyList>
