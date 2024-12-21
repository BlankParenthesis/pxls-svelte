<script lang="ts" context="module">
	export enum Mode {
		Clock,
		Block,
	};
</script>
<script lang="ts">
	import { now } from "./Time.svelte";
	
	export let mode: Mode = Mode.Clock;
	
	const CLOCKS = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕘", "🕚"];
	const BLOCKS = ["⬜", "🟥", "🟧", "🟨", "🟩", "🟪", "🟦", "⬛"];
</script>
<style>
</style>
{#if mode === Mode.Clock}
	{CLOCKS[Math.floor($now / 1000) % CLOCKS.length]}
{:else if mode === Mode.Block}
	{BLOCKS[Math.floor($now / 1000) % BLOCKS.length]}
{/if}
