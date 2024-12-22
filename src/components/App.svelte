<script lang="ts">
	import Canvas from "./Canvas.svelte";
	import { Site } from "../lib/site";
	import { collect } from "../lib/util";
	import { BoardInfo } from "../lib/board/info";
	import BoardSelect from "./BoardSelect.svelte";
	import type { Reference } from "../lib/reference";
	import Login from "./Login.svelte";
	import Splash from "./layout/Splash.svelte";

	const connecting = Site.connect(new URL(import.meta.env.VITE_TARGET_SITE));
	let select: (board: Reference<BoardInfo>) => void;
	const boardSelect = new Promise<Reference<BoardInfo>>(resolve => select = resolve);
</script>
{#await connecting}
	<Splash>
		<p>Connecting…</p>
		<progress max=1 value=0.1 />
	</Splash>
{:then site}
	{#await site.defaultBoard()}
		<Splash>
			<p>Finding default board…</p>
			<progress max=1 value=0.4 />
		</Splash>
	{:then defaultBoard}
		{#await site.boards.get(defaultBoard.uri)}
			<Splash>
				<p>Loading board…</p>
				<progress max=1 value=0.8 />
			</Splash>
		{:then board}
			<Canvas {site} {board}/>
		{:catch e}
			<Splash>
				<h2>Loading error</h2>
				<p>{e}</p>
				<Login auth={site.auth}/>
			</Splash>
		{/await}
	{:catch}
		{#await collect(site.fetchBoards())}
			<Splash>
				<p>Loading board list…</p>
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
					<Splash>
						<p>Loading board…</p>
						<progress max=1 value=0.8 />
					</Splash>
				{:then board}
					<Canvas {site} {board} />
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
	{/await}
{:catch e}
	<Splash>
		<h2>Connection error</h2>
		<p>{e}</p>
	</Splash>
{/await}
