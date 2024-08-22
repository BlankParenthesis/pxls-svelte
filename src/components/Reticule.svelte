<script lang="ts">
    import type { Vec2 } from "ogl";
    import type { AppState } from "../lib/settings";
    import type { Palette } from "../lib/board/palette";

	export let position: Vec2;
	export let size: number;

	export let palette: Palette;
	export let gamestate: AppState;

	// duplicated from palette
	function colorToHex(color: number | undefined) {
		return color?.toString(16).padStart(8, "0");
	}
</script>
<style>
	.reticule {
		position: absolute;
		border: 2px solid black;
		pointer-events: none;
		box-sizing: border-box;
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
		style:background-color="#{colorToHex(palette.get(gamestate.selectedColor)?.value)}"
	></div>
{/if}