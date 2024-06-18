<script lang="ts">
    import { type DebugSettings } from "../lib/settings";

	export let settings: DebugSettings;
</script>
<style>
	button, output, label {
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
	<label>Heatmap Start<input type="range" min="0" max="355411" bind:value="{settings.render.timestampStart}"/></label>
	<label>Heatmap End<input type="range" min="0" max="355411" bind:value="{settings.render.timestampEnd}"/></label>
	<label>Heatmap Dimming<input type="range" min="0" max="1" step="0.01" bind:value="{settings.render.heatmapDim}"/></label>
</div>