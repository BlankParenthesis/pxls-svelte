<script lang="ts">
    import type { Readable } from "svelte/motion";
    import type { ViewBox } from "../lib/render/canvas";
    import type { Shape } from "../lib/render/shape";

	let innerWidth: number;
	let innerHeight: number;

	export let position: number;
	export let scale: number[];

	export let viewbox: ViewBox;
	export let shape: Shape;
	
	$: size = Math.min(...scale)
		* Math.max(innerWidth, innerHeight)
		/ Math.max(...shape.size())
		/ 2;

	$: [boardWidth, boardHeight] = shape.size();

	$: indexArray = shape.positionToIndexArray(position);
	$: [boardX, boardY] = shape.indexArrayToCoordinates(indexArray);
	$: [x, y] = viewbox.outof(boardX / boardWidth, boardY / boardHeight);
</script>
<svelte:window bind:innerWidth bind:innerHeight />
<div
	class="cursor-transparent"
	style:width="{size}px"
	style:height="{size}px"
	style:left="{x * innerWidth}px"
	style:top="{y * innerHeight}px"
>
	<slot />
</div>