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

	export let settings: Settings;
	export let site: Site;
	export let gamestate: GameState;
	const auth = site.auth;
	export let board: Board;
	const cooldown = board.cooldown;
	const info = board.info;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";
</script>
<style>
	.card {
		background-color: white;
		padding: 1em;
		border-top-left-radius: 0.5em;
		border-top-right-radius: 0.5em;
	}
</style>
<Grid>
	<aside class="bottom-right">
		<Debug bind:settings={settings.debug} />
	</aside>
	<aside class="bottom card">
		<Login {auth} />
		{#if loggedIn}
			<Cooldown info={$info} cooldown={$cooldown} />
			<Palette bind:gamestate {board} />
		{/if}
	</aside>
</Grid>
