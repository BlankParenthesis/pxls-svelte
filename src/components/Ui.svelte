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
    import UserCount from "./UserCount.svelte";

	export let settings: Settings;
	export let site: Site;
	export let state: AppState;
	export let access: Readable<Promise<Set<string>>>;
	const auth = site.auth;
	export let board: Board;
	const cooldown = board.cooldown;
	const info = board.info;
	const token = auth.token;
	const userCount = board.userCount();
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
		Place,
		Account,
		Templates,
		Settings,
	}

	let panel = Panel.None;

	const currentUser = site.currentUser();
</script>
<style>
	.grid-5 {
		display: grid;
		grid-template-columns: 3fr 3fr 2fr 3fr 3fr;
	}

	.end {
		display: flex;
		flex-direction: column;
		justify-content: end;
	}
</style>
<Grid maxwidth="43em" maxheight="100%">
	{#await $access then access}
		<div class="bottom-center flex vertical reverse panel">
			<nav class="grid-5 switcher">
				{#if loggedIn && access.has("users.current.get")}
					<button 
						class="switcher-button"
						class:active={panel == Panel.Account}
						on:click={toggle(Panel.Account)}
					>
						<div class="icon large">👤</div>
						<small>Account</small>
					</button>
				{:else}
					<Login {auth} />
				{/if}
				<div></div>
				<button
					class="switcher-button"
					class:active={panel == Panel.Place}
					disabled={!access.has("boards.pixels.post")}
					on:click={toggle(Panel.Place)}
				>
					<div class="icon large">🎨</div>
					<small>Palette</small>
				</button>
				<button
					class="switcher-button"
					class:active={panel == Panel.Templates}
					on:click={toggle(Panel.Templates)}
				>
					<div class="icon large">📐</div>
					<small>Templates</small>
				</button>
				<button
					class="switcher-button"
					class:active={panel == Panel.Settings}
					on:click={toggle(Panel.Settings)}
				>
					<div class="icon large">🔧</div>
					<small>Settings</small>
				</button>
			</nav>
			
			{#if panel == Panel.Place}
				<div class="drawer">
					{#if panel == Panel.Place}
						<Cooldown info={$info} cooldown={$cooldown} />
						{#if access.has("boards.users")}
							<UserCount count={$userCount} />
						{/if}
						<Palette bind:state {board} />
					{/if}
				</div>
			{/if}
		</div>
		{#if panel == Panel.Account}
			<div class="glass left"></div>
			<div class="center-center panel flex vertical">
				{#await $currentUser}
					<div class="flex space middle">
						<h2>Account</h2>
						<p>Loading</p>
					</div>
				{:then user}
					<Account {access} {auth} {site} user={user.fetch()}/>
				{/await}
			</div>
			<div class="glass right"></div>
		{:else if panel == Panel.Place}
			<div class="center-center cursor-transparent end">
				<Tools {board} {access} bind:state bind:settings />
			</div>
		{:else if panel == Panel.Templates}
			<div class="glass left"></div>
			<div class="center-center panel">
				<Templates bind:templates={state.templates} />
			</div>
			<div class="glass right"></div>
		{:else if panel == Panel.Settings}
			<div class="glass left"></div>
			<div class="center-center panel">
				<SettingsPanel bind:settings />
			</div>
			<div class="glass right"></div>
		{/if}
	{/await}
</Grid>
