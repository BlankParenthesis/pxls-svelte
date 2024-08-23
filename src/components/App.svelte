<script lang="ts">
    import type { AppState, Settings } from "../lib/settings";
	import Canvas from "./Canvas.svelte";
	import Ui from "./Ui.svelte";
	import Stack from "./layout/Stack.svelte";
	import { Site } from "../lib/site";
    import { collect } from "../lib/util";
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
		heatmap: {
			enabled: false,
			duration: 3600, // one hour
			position: -1, // "now" (`-1 + 1` seconds ago)
			dimming: 0.75,
		},
	};

	let gamestate: AppState = {
		selectedColor: undefined,
		adminOverrides: {
			mask: false,
			color: false,
			cooldown: false,
		}
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
					<Canvas {gamestate} {board} {settings}/>
					<Ui bind:state={gamestate} {site} {board} bind:settings />
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