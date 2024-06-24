<script lang="ts">
	import Grid from "./layout/Grid.svelte";
	import Debug from "./Debug.svelte";
	import Login from "./Login.svelte";
	import Palette from "./Palette.svelte";
    import { type Settings } from "../lib/settings";
    import { type Board } from "../lib/board/board";
    import { type Site } from "../lib/site";
    import Cooldown from "./Cooldown.svelte";

	export let settings: Settings;
	export let site: Site;
	const auth = site.auth;
	export let board: Board;
	const cooldown = board.cooldown;
	const info = board.info;
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
	<aside class="top-right">
		<Debug bind:settings={settings.debug} />
	</aside>
	<aside class="bottom card">
		<Login {auth} />
		<Cooldown info={$info} cooldown={$cooldown} />
		<Palette {board} />
	</aside>
</Grid>
