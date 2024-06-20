<script lang="ts">
	import { Board } from "../lib/board/board";

	export let board: Board;
</script>
<style>
	ul {
		margin: 0;
		padding: 0;

		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
	}

	li {
		list-style-type: none;
	}
</style>
<ul>
	{#await board.info() then info}
		{#each info.palette as [index, color]}
			{#if !color.system_only }
				<li><button>{color.name}</button></li>
			{/if}
		{/each}
	{/await}
</ul>