<script lang="ts">
	import type { LookupData as DataType } from "../lib/pointer";
    import LookupData from "./LookupData.svelte";

	export let finalizer: Promise<{ data: DataType, complete: () => void }>;
</script>
<style>
	.reticule {
		position: relative;
		width: 100%;
		height: 100%;
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
		from { opacity: 1.0; }
		to { opacity: 0.0; }
	}
	
	.complete {
		animation: complete 200ms;
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
	<div class="reticule pending cursor-transparent"></div>
{:then { complete, data }}
	{#await data.dismissal}
		<div class="reticule cursor-transparent">
			<LookupData lookup={data.lookup} />
		</div>
	{:then}
		<div
			class="reticule complete cursor-transparent"
			on:animationend={complete}
		>
			<LookupData lookup={data.lookup} />
		</div>
	{/await}
{:catch complete} 
	<div
		class="reticule error cursor-transparent"
		on:animationend={complete}
	></div>
{/await}
