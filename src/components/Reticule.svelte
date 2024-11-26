<script lang="ts">
    import type { Pointer } from "../lib/settings";

	export let pointer: Pointer;
</script>
<style>
	.reticule {
		position: relative;
		width: 100%;
		height: 100%;
		border: 2px solid black;
		box-sizing: border-box;
	}
</style>
<div class="reticule cursor-transparent" style:background="{pointer.background}"></div>