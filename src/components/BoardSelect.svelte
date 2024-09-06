<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import type { BoardInfo } from "../lib/board/info";
    import type { Reference } from "../lib/reference";

	export let info: Reference<BoardInfo>;
	const board = info.fetch();

	const dispatch = createEventDispatcher();
</script>
{#await $board}
	<h4>Loading Board Info…</h4>
{:then board}
	<h4>{board.name}</h4>
	<p>Shape: {board.shape}<p/>
	<button on:click="{() => dispatch("select", info)}">Connect</button>
{/await}
