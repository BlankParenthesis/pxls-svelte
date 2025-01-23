<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { Faction } from "../lib/faction";
	import FactionDisplay from "./Faction.svelte";

	export let faction: Readable<Promise<Faction> | undefined>;
	export let access: Set<string>;
</script>
<style>
</style>
{#if typeof $faction !== "undefined"}
	<li><FactionDisplay faction={$faction} {access} /></li>
{/if}
