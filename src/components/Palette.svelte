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
		background-position: 0 0, 0 0, 50% 50%;
		background-size: auto, 50% 50%, 50% 50%;
		
		--transparent-dark: #7E7F83;
		--transparent-light: #C1C1C3;

		background-image: linear-gradient(var(--color), var(--color)),
			repeating-linear-gradient(45deg, var(--transparent-light) 25%, transparent 25%, transparent 75%, var(--transparent-light) 75%, var(--transparent-light)),
			repeating-linear-gradient(45deg, var(--transparent-light) 25%, var(--transparent-dark) 25%, var(--transparent-dark) 75%, var(--transparent-light) 75%, var(--transparent-light));
	}

	.color.selected {
		background-image: transparent !important;
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
					style="--color: #{colorToHex(color.value)}"
					class:selected={state.selectedColor === index}
					class="color"
				/>
			</li>
		{/if}
	{/each}
</ul>