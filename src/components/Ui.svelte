<script lang="ts">
	import Grid from "./layout/Grid.svelte";
	import Login from "./Login.svelte";
	import Palette from "./Palette.svelte";
    import { type Settings } from "../lib/settings";
    import { type Board } from "../lib/board/board";
    import { type Site } from "../lib/site";
    import { type GameState } from "../lib/util";
    import Cooldown from "./Cooldown.svelte";
    import SettingsPanel from "./Settings.svelte";
    import Account from "./Account.svelte";
    import AdminTools from "./AdminTools.svelte";
    import Templates from "./Templates.svelte";

	export let settings: Settings;
	export let site: Site;
	export let gamestate: GameState;
	const auth = site.auth;
	export let board: Board;
	const cooldown = board.cooldown;
	const info = board.info;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";

	const toggle = (panelMode: Panel) => {
		return () => {
			if (panel == panelMode) {
				panel = Panel.None;
			} else {
				panel = panelMode;
			}
		}
	};

	enum Panel {
		None,
		Account,
		Admin,
		Templates,
		Settings,
	}

	let panel = Panel.None;
</script>
<style>
	.card {
		background-color: white;
		display: inline-block;
	}

	.grid-5 {
		display: grid;
		grid-template-columns: 1fr 1fr auto 1fr 1fr;
	}

	button.active {
		background-color: #789abc;
		color: white;
	}

	.end {
		display: flex;
		flex-direction: column;
		justify-content: end;
	}
</style>
<Grid maxwidth="40em" maxheight="100%">
	<div class="bottom-center card">
		<nav class="grid-5">
			{#if loggedIn}
				<button class:active={panel == Panel.Account} on:click={toggle(Panel.Account)}>Account</button>
			{:else}
				<Login {auth} />
			{/if}
			<button class:active={panel == Panel.Admin} on:click={toggle(Panel.Admin)}>Admin Tools</button>
			<div class="center">
				{#if loggedIn}
					<Cooldown info={$info} cooldown={$cooldown} />
				{:else}
					Login to place pixels
				{/if}
			</div>
			<button class:active={panel == Panel.Templates} on:click={toggle(Panel.Templates)}>Templates</button>
			<button class:active={panel == Panel.Settings} on:click={toggle(Panel.Settings)}>Settings</button>
		</nav>

		
		{#if loggedIn}
			<Palette bind:gamestate {board} />
		{/if}
	</div>
	{#if panel == Panel.Account}
		<div class="center-center card">
			<Account {auth} />
		</div>
	{:else if panel == Panel.Admin}
		<div class="center-center cursor-transparent end">
			<AdminTools />
		</div>
	{:else if panel == Panel.Templates}
		<div class="center-center card">
			<Templates />
		</div>
	{:else if panel == Panel.Settings}
		<div class="center-center card">
			<SettingsPanel bind:settings={settings} />
		</div>
	{/if}
</Grid>
