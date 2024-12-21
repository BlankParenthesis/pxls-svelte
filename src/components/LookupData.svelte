<script lang="ts">
	import type { Readable } from "svelte/store";
	import { Pixel } from "../lib/pixel";
	import Time, { Mode as TimeMode } from "./Time.svelte";
	import LookupUser from "./LookupUser.svelte";

	export let lookup: Readable<Promise<Pixel | undefined> | undefined>;
</script>
<style>
	.bubble {
		position: absolute;
		/* 1em = the height of the arrow */
		bottom: calc(100% + 1em);
		left: 50%;
		transform: translateX(-50%);
		max-width: 12em;
		/* 4em = 2×the width of the arrow */
		min-width: 4em;
		box-sizing: border-box;
		border-style: solid;
		border-width: 2px;
		padding: .25em;
		text-align: center;
		color: var(--bubble-color);
		border-color: var(--bubble-background);
		background: var(--bubble-background);
		box-shadow: 0 2px 5px #00000077;
	}
	
	.arrow, .arrow-shadow {
		position: absolute;
		bottom: calc(100% + 1em);
		left: 50%;
		transform: translateX(-50%);
		pointer-events: none;
	}
	
	.arrow::after, .arrow-shadow::before {
		content: "";
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		border-style: solid;
		border-bottom-style: none;
		border-left-width: 2em;
		border-right-width: 2em;
		border-top-width: 1em;
		border-color: transparent;
	}
	
	/* the shadow */
	.arrow-shadow::before {
		top: calc(100% + 2px);
		border-top-color: #00000077;
		filter: blur(5px);
	}
	
	/* the arrow itself */
	.arrow::after {
		top: 100%;
		border-top-color: var(--bubble-background);
	}
</style>
<div class="arrow-shadow"></div>
<div class="bubble fully-cursor-transparent">
	{#if typeof $lookup === "undefined"}
		Outdated lookup
	{:else}
		{#await $lookup }
			Loading Pixel…
		{:then pixel }
			{#if typeof pixel === "undefined"}
				Never placed
			{:else}
				{#if typeof pixel.user !== "undefined"}
					<LookupUser user={pixel.user} />
				{/if}
				<Time time={pixel.modified} mode={TimeMode.Relative} />
			{/if}
		{:catch}
			<div>Lookup Error</div>
		{/await}
	{/if}
</div>
<div class="arrow"></div>
