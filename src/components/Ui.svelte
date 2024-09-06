<script lang="ts">
	import Grid from "./layout/Grid.svelte";
	import Login from "./Login.svelte";
	import Palette from "./Palette.svelte";
    import type { Settings } from "../lib/settings";
    import type { Board } from "../lib/board/board";
    import type { Site } from "../lib/site";
	import type { AppState } from "../lib/settings";
    import Cooldown from "./Cooldown.svelte";
    import SettingsPanel from "./Settings.svelte";
    import Account from "./Account.svelte";
    import Tools from "./Tools.svelte";
    import Templates from "./Templates.svelte";
    import type { Readable } from "svelte/store";

	export let settings: Settings;
	export let site: Site;
	export let state: AppState;
	export let access: Readable<Promise<Set<string>>>;
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

	const currentUser = site.currentUser();
</script>
<style>
	.card {
		background-color: white;
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
	{#await $access then access}
		<div class="bottom-center card">
			<nav class="grid-5">
				{#if loggedIn && access.has("users.current.get")}
					<button class:active={panel == Panel.Account} on:click={toggle(Panel.Account)}>Account</button>
				{:else}
					<Login {auth} />
				{/if}
				<button class:active={panel == Panel.Admin} on:click={toggle(Panel.Admin)}>Tools</button>
				<div class="center">
					{#if access.has("boards.pixels.post")}
						<Cooldown info={$info} cooldown={$cooldown} />
					{:else if !loggedIn}
						Login to place pixels
					{/if}
				</div>
				<button class:active={panel == Panel.Templates} on:click={toggle(Panel.Templates)}>Templates</button>
				<button class:active={panel == Panel.Settings} on:click={toggle(Panel.Settings)}>Settings</button>
			</nav>

			
			{#if access.has("boards.pixels.post")}
				<Palette bind:state {board} />
			{/if}
		</div>
		{#if panel == Panel.Account}
			<div class="center-center card flex vertical">
				{#await $currentUser}
					<div class="flex space middle">
						<h2>Account</h2>
						<p>Loading</p>
					</div>
				{:then user}
					<Account {access} {auth} {site} user={user.fetch()}/>
				{/await}
			</div>
		{:else if panel == Panel.Admin}
			<div class="center-center cursor-transparent end">
				<Tools {board} {access} bind:state bind:settings />
			</div>
		{:else if panel == Panel.Templates}
			<div class="center-center card">
				<Templates bind:templates={state.templates} />
			</div>
		{:else if panel == Panel.Settings}
			<div class="center-center card">
				<SettingsPanel bind:settings />
			</div>
		{/if}
	{/await}
</Grid>
