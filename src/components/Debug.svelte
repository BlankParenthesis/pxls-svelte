<script lang="ts">
    import { type DebugSettings } from "../lib/settings";
    import { persistentWritable } from "../lib/storage/persistent";
	import { z } from "zod";

	export let settings: DebugSettings;

	const persistence = persistentWritable(
		"debugText",
		z.string().parse,
		"default text",
	);

	function checkAutoDetail(event: Event) {
		if (settings.render.detailLevel == -1) {
			settings.render.detailLevel = undefined;
		}
	}

	let shape = "";
</script>
<style>
	button, output, label, input[type=text] {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: x-large;
		font-weight: bold;
		font-family: monospace;
		padding: .25em .5em;
	}

	output, label {
		background-color: aliceblue;
		border-style: outset;
		border-width: 1px;
		border-color: #77b;
		border-radius: .25em;
		gap: 0.5em;
	}

	input[type="checkbox"] {
		margin-left: 0;
	}

	input[type="number"] {
		width: 3em;
	}

	.vertical {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5em;
	}
</style>
<div class="vertical">
	<label>
		Detail Level
		<input type="number" min="-1" step="1" bind:value="{settings.render.detailLevel}" on:change="{checkAutoDetail}"/>
	</label>
	<label>
		Zoom minimum override
		<input type="checkbox" bind:checked="{settings.render.zoom}"/>
	</label>
	<label>
		Debug Render
		<input type="checkbox" bind:checked="{settings.render.debug}"/>
	</label>
	{#if settings.render.debug}
		<label>
			Debug Outline
			<input type="range" min="0" max="1" step="0.01" bind:value="{settings.render.debugOutline}"/>
		</label>
		<label>
			Debug Outline Stripe
			<input type="range" min="0" max="1" step="0.01" bind:value="{settings.render.debugOutlineStripe}"/>
		</label>
	{/if}
</div>