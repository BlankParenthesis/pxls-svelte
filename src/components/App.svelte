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
    import Login from "./Login.svelte";
    import Splash from "./layout/Splash.svelte";

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
<Stack>
	{#await connecting}
		<Splash>
			<p>Connecting…</p>
			<progress max=1 value=0.1 />
		</Splash>
	{:then site}
		{#await collect(site.fetchBoards())}
			<Splash>
				<p>Loading boards…</p>
				<progress max=1 value=0.6 />
			</Splash>
		{:then boards}
			{#await boardSelect}
				<div>
					<ul>
						{#each boards as board}
							<li>
								<BoardSelect info={board} on:select={b => select(b.detail)}/>
							</li>
						{/each}
					</ul>
					<hr />
					<Login auth={site.auth}/>
				</div>
			{:then reference}
				{#await site.boards.get(reference.uri)}
					<Splash><p>Loading board…</p></Splash>
				{:then board}
					<Canvas bind:gamestate {board} {settings}/>
					<Ui
						{site}
						{board}
						bind:state={gamestate}
						bind:settings
						access={site.access()}
					/>
				{:catch e}
					<Splash>
						<h2>Failed to load board</h2>
						<p>{e}</p>
					</Splash>
				{/await}
			{/await}
		{:catch e}
			<Splash>
				<h2>Loading error</h2>
				<p>{e}</p>
				<Login auth={site.auth}/>
			</Splash>
		{/await}
	{:catch e}
		<Splash>
			<h2>Connection error</h2>
			<p>{e}</p>
		</Splash>
	{/await}
</Stack>