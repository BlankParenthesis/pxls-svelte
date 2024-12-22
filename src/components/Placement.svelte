<script lang="ts">
	import { Pixel } from "../lib/pixel";

	export let color: string;
	export let finalizer: Promise<{ data: Pixel; complete: () => void }>;
</script>
<style>
	.reticule {
		position: relative;
		width: 100%;
		height: 100%;
		border-width: 2px;
		border-style: solid;
		border-color: black;
		box-sizing: border-box;
	}

	@keyframes pending {
		from { border-color: black; }
		to { border-color: transparent; }
	}

	.pending {
		animation: pending 500ms alternate infinite;
	}

	@keyframes complete {
		from { border-color: green; }
		to { border-color: transparent; }
	}

	.complete {
		animation: complete 500ms;
	}

	@keyframes error {
		from { opacity: 1.0; }
		to { opacity: 0.0; }
	}

	.error {
		border-color: red;
		animation: error 500ms;
	}
</style>
{#await finalizer}
	<div
		class="reticule pending cursor-transparent"
		style:background="{color}"
	></div>
{:then { complete }}
	<div
		class="reticule complete cursor-transparent"
		on:animationend={complete}
	></div>
{:catch complete}
	<div
		class="reticule error cursor-transparent"
		style:background="{color}"
		on:animationend={complete}
	></div>
{/await}
