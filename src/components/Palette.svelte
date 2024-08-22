<script lang="ts">
	import { z } from "zod";
	import { Board } from "../lib/board/board";
    import type { AppState } from "../lib/settings";

	export let board: Board;
	export let state: AppState;
	const info = board.info; // TODO: listen to the palette directly

	const Index = z.number().int().min(0);

	function selectColor(this: HTMLButtonElement) {
		const index = Index.parse(parseInt(this.dataset["index"] as string));
		if (state.selectedColor == index) {
			state.selectedColor = undefined;
		} else {
			state.selectedColor = index;
		}
	}

	function colorToHex(color: number) {
		return color.toString(16).padStart(8, "0");
	}
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

	.color {
		width: 3em;
		height: 3em;
		box-sizing: border-box;
	}

	.color.selected {
		background-color: transparent !important;
		border-style: dashed;
	}
</style>
	
<ul>
	{#each $info.palette as [index, color]}
		{#if !color.system_only || state.adminOverrides.color }
			<li>
				<button
					data-index={index}
					on:click={selectColor}
					style:background-color="#{colorToHex(color.value)}"
					class:selected={state.selectedColor === index}
					class="color"
				/>
			</li>
		{/if}
	{/each}
</ul>