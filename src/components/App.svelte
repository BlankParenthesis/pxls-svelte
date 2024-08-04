<script lang="ts">
    import type { RenderParameters } from "../lib/render/canvas";
    import type { Settings } from "../lib/settings";
	import Canvas from "./Canvas.svelte";
	import Ui from "./Ui.svelte";
	import Stack from "./layout/Stack.svelte";
	import { Site } from "../lib/site";
    import type { Template } from "../lib/render/template";
    import { Mat3, Vec2 } from "ogl";
    import { collect, type GameState } from "../lib/util";
    import type { BoardStub } from "../lib/board/board";

	let settings: Settings = {
		debug: {
			render: {
				debug: false,
				debugOutline: 0.05,
				debugOutlineStripe: 0.1,
				zoom: false,
			},
		},
	};

	let gamestate: GameState = {
		selectedColor: undefined,
	};

	let render: RenderParameters = {
		transform: new Mat3().identity().translate(new Vec2(-0.5, -0.5)),
		templates: [] as Template[],
		timestampStart: 0,
		timestampEnd: 0,
		heatmapDim: 0,
	};

	const connecting = Site.connect(new URL(import.meta.env.VITE_TARGET_SITE));
	let select: (board: BoardStub) => void;
	const boardSelect = new Promise<BoardStub>(resolve => select = resolve);
</script>
{#await connecting}
	Connecting…
{:then site}
	{#await collect(site.boards())}
		Loading boards…
	{:then boards}
		{#await boardSelect}
			<ul>
				{#each boards as board}
					<li>
						{#if board.info}
							<h4>{board.info.name}</h4>
							<p>Shape: {board.info.shape}<p/>
							<button on:click="{() => select(board)}">Connect</button>
						{:else}
							<h4>Info unknown</h4>
							<p>Location: {board.uri.href}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{:then board}
			{#await board.connect()}
				Loading board…
			{:then board}
				<Stack>
					<Canvas {gamestate} {board} parameters={render} overrides={settings.debug.render}/>
					<Ui bind:gamestate {site} {board} bind:settings />
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