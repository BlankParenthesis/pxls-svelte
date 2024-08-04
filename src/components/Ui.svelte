<script lang="ts">
	import Grid from "./layout/Grid.svelte";
	import Debug from "./Debug.svelte";
	import Login from "./Login.svelte";
	import Palette from "./Palette.svelte";
    import { type Settings } from "../lib/settings";
    import { type Board } from "../lib/board/board";
    import { type Site } from "../lib/site";
    import { type GameState } from "../lib/util";
    import Cooldown from "./Cooldown.svelte";
    import Toggle from "./Toggle.svelte";

	export let settings: Settings;
	export let site: Site;
	export let gamestate: GameState;
	const auth = site.auth;
	export let board: Board;
	const cooldown = board.cooldown;
	const info = board.info;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";

	let showSettings = false;
</script>
<style>
	.card {
		background-color: white;
		display: inline-block;
		min-width: 40em;
	}

	.left { text-align: left; }
	.right { text-align: right; }
</style>
<Grid>
	<div class="bottom-center card">
		<Grid>
			<div class="left"><Login {auth} /></div>
			<div class="center"><Cooldown info={$info} cooldown={$cooldown} /></div>
			<div class="right"><Toggle bind:state={showSettings}>Settings</Toggle></div>
		</Grid>

		
		{#if loggedIn && !showSettings}
			<Palette bind:gamestate {board} />
		{/if}
	</div>
	{#if showSettings}
		<div class="center-center card">
			<h2>Settings Menu</h2>
			<p>There would be some settings here</p>
			<Debug bind:settings={settings.debug} />
		</div>
	{/if}
</Grid>
