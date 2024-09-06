<script lang="ts">
    import type { AppState, Settings } from "../lib/settings";
	import Canvas from "./Canvas.svelte";
	import Ui from "./Ui.svelte";
	import Stack from "./layout/Stack.svelte";
	import { Site } from "../lib/site";
    import { collect } from "../lib/util";
    import { Board } from "../lib/board/board";
    import { BoardInfo } from "../lib/board/info";
    import templateStyle from "../assets/large_template_style.webp";
    import BoardSelect from "./BoardSelect.svelte";
    import type { Reference } from "../lib/reference";

	let settings: Settings = {
		debug: {
			render: {
				debug: false,
				debugOutline: 0.05,
				debugOutlineStripe: 0.1,
				zoom: false,
			},
		},
		heatmap: {
			enabled: false,
			duration: 3600, // one hour
			position: -1, // "now" (`-1 + 1` seconds ago)
			dimming: 0.75,
		},
		template: {
			source: templateStyle,
		},
	};

	let gamestate: AppState = {
		pointer: undefined,
		adminOverrides: {
			mask: false,
			color: false,
			cooldown: false,
		},
		templates: [],
	};

	const connecting = Site.connect(new URL(import.meta.env.VITE_TARGET_SITE));
	let select: (board: Reference<BoardInfo>) => void;
	const boardSelect = new Promise<Reference<BoardInfo>>(resolve => select = resolve);
</script>
{#await connecting}
	Connecting…
{:then site}
	{#await collect(site.fetchBoards())}
		Loading boards…
	{:then boards}
		{#await boardSelect}
			<ul>
				{#each boards as board}
					<li>
						<BoardSelect info={board} on:select={b => select(b.detail)}/>
					</li>
				{/each}
			</ul>
		{:then reference}
			{#await site.boards.get(reference.uri)}
				Loading board…
			{:then board}
				<Stack>
					<Canvas {gamestate} {board} {settings}/>
					<Ui
						{site}
						{board}
						bind:state={gamestate}
						bind:settings
						access={site.access()}
					/>
				</Stack>
			{:catch e}
				Board {e}
			{/await}
		{/await}
	{:catch e}
		Board {e}
	{/await}
{:catch e}
	Site {e}
{/await}