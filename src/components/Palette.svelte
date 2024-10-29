<script lang="ts">
	import { Board } from "../lib/board/board";
    import type { AppState } from "../lib/settings";

	export let board: Board;
	export let state: AppState;
	const info = board.info; // TODO: listen to the palette directly

	$: pointerDefined = typeof state.pointer !== "undefined";
	$: placing = state.pointer?.type === "place";
	$: quickPlacing = state.pointer?.type === "quick-place";
	$: selectedColor = (pointerDefined && (placing || quickPlacing))
		/* @ts-ignore: Validated through the above checks */
		? state.pointer.selected
		: undefined;

	let movedDistance = 0;

	function toggleColor(index: number) {
		const color = $info.palette.get(index);
		if (typeof color === "undefined") {
			throw new Error("invalid color");
		}
		
		if (state.pointer?.type === "place" && state.pointer.selected === index) {
			deselectColor();
		} else {
			movedDistance = 0;
			state.pointer = {
				type: "quick-place",
				selected: index,
				background: "#" + colorToHex(color.value),
				async activate(x, y) {
					await board.place(x, y, index, state.adminOverrides);
				}
			}
		}
	}

	function deselectColor() {
		const DISTANCE_THRESHOLD = 10;
		if (movedDistance > DISTANCE_THRESHOLD) {
			state.pointer = undefined;
		} else if (state.pointer?.type === "quick-place") {
			state.pointer.type = "place";
		} else {
			state.pointer = undefined;
		}
	}

	function colorToHex(color: number) {
		return color.toString(16).padStart(8, "0");
	}

	function trackMouse(event: MouseEvent) {
		movedDistance += Math.sqrt(event.movementX ** 2 + event.movementY ** 2);
	}
</script>
<style>
	ul {
		margin: 0;
		padding: 0;

		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
		justify-content: center;
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
		background: transparent !important;
		border-style: dashed;
	}
</style>
<svelte:window on:mousemove={trackMouse} />
<ul>
	{#each $info.palette as [index, color]}
		{#if !color.system_only || state.adminOverrides.color }
			<li>
				<button
					on:mousedown={() => toggleColor(index)}
					on:mouseup={() => deselectColor()}
					style="--color: #{colorToHex(color.value)}"
					class:selected={selectedColor === index}
					class="color"
				/>
			</li>
		{/if}
	{/each}
</ul>