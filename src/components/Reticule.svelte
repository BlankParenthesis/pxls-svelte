<script lang="ts">
    import type { Vec2 } from "ogl";
    import type { Pointer } from "../lib/settings";

	export let position: Vec2;
	export let size: number;

	export let pointer: Pointer;
</script>
<style>
	.reticule {
		position: absolute;
		border: 2px solid black;
		pointer-events: none;
		box-sizing: border-box;
	}
</style>
<div
	class="reticule"
	style:width="{size}px"
	style:height="{size}px"
	style:left="{position.x}px"
	style:top="{position.y}px"
	style:font-size="{size}px"
	style:background="{pointer.background}"
></div>