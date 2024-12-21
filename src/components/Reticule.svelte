<script lang="ts">
	import type { Pointer } from "../lib/pointer";

	export let pointer: Pointer;
</script>
<style>
	.reticule {
		position: relative;
		box-sizing: border-box;
		overflow: visible;
	}
	
	.place {
		width: 100%;
		height: 100%;
		border: 2px solid #000;
	}
	
	.lookup {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
{#if pointer.type === "place"}
	<div class="reticule place cursor-transparent" style:background="{pointer.color}"></div>
{:else if pointer.type === "lookup"}
	<div class="reticule lookup cursor-transparent">🔍</div>
{/if}
