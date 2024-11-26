<script lang="ts">
    import { Vec2 } from "ogl";
    import type { ViewBox } from "../lib/render/canvas";
    import type { Shape } from "../lib/render/shape";
    import Exact from "./layout/Exact.svelte";

	export let viewbox: ViewBox;
	export let shape: Shape;
	export let boardSize: Vec2;
	export let position: number;

	$: [boardWidth, boardHeight] = shape.size();

	$: indexArray = shape.positionToIndexArray(position);
	$: [boardX, boardY] = shape.indexArrayToCoordinates(indexArray);
	$: [x, y] = viewbox.outof(boardX / boardWidth, boardY / boardHeight);
	// we can compute the size of a pixel by offsetting by one in both 
	// directions and comparing:
	$: [x2, y2] = viewbox.outof((boardX + 1) / boardWidth, (boardY + 1) / boardHeight);
	$: [width, height] = [x2 - x, y2 - y];
</script>
<Exact
	x={x * boardSize.x}
	y={y * boardSize.y}
	width={width * boardSize.x}
	height={height * boardSize.y}
>
	<slot />
</Exact>