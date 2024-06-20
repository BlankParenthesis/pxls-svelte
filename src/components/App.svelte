<script lang="ts">
    import { DEFAULT_RENDER_SETTINGS } from "../lib/render/canvas";
    import { type Settings } from "../lib/settings";
	import Canvas from "./Canvas.svelte";
	import Ui from "./Ui.svelte";
	import Stack from "./layout/Stack.svelte";
	import { Site } from "../lib/site";

	let autoDetail = DEFAULT_RENDER_SETTINGS.autoDetail;
	let detailLevel = DEFAULT_RENDER_SETTINGS.detailLevel;
	let templates = DEFAULT_RENDER_SETTINGS.templates;
	let timestampStart = DEFAULT_RENDER_SETTINGS.timestampStart;
	let timestampEnd = DEFAULT_RENDER_SETTINGS.timestampEnd;
	let heatmapDim = DEFAULT_RENDER_SETTINGS.heatmapDim;

	let settings: Settings = {
		debug: {
			render: {
				autoDetail,
				detailLevel,
				templates,
				heatmapDim,
				timestampStart,
				timestampEnd,
			},
		},
	};

	const siteUrl = new URL("http://localhost:45632");
	const site = new Site(siteUrl);
</script>

<Stack>
	{#await site.defaultBoard().then(b => b.connect()) then board}
		<Canvas {board} renderOptions={settings.debug.render}/>
	{/await}
	<Ui bind:settings/>
</Stack>