<script lang="ts">
    import type { Vec2 } from "ogl";
    import type { GameState } from "../lib/util";

	export let position: Vec2;
	export let size: number;
	export let gamestate: GameState;
</script>
<style>
	.reticule {
		position: absolute;
		border: 2px solid red;
		pointer-events: none;
		box-sizing: border-box;
		
		line-height: 1em;
		text-align: center;
	}
</style>
{#if typeof gamestate.selectedColor !== "undefined" }
	<div
		class="reticule"
		style:width="{size}px"
		style:height="{size}px"
		style:left="{position.x}px"
		style:top="{position.y}px"
		style:font-size="{size}px"
	>{gamestate.selectedColor}</div>
{/if}