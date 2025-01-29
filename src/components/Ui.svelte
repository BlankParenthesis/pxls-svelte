<!-- eslint fix comment -->
<script lang="ts">
	import Grid from "./layout/Grid.svelte";
	import Login from "./Login.svelte";
	import Palette from "./Palette.svelte";
	import type { Settings } from "../lib/settings";
	import type { Board } from "../lib/board/board";
	import type { Site } from "../lib/site";
	import type { AppState } from "../lib/settings";
	import Time, { Mode as TimeMode } from "./Time.svelte";
	import SettingsPanel from "./Settings.svelte";
	import Account from "./Account.svelte";
	import Tools from "./Tools.svelte";
	import Templates from "./Templates.svelte";
	import Pixelstack from "./Pixelstack.svelte";
	import FactionsPanel from "./FactionsPanel.svelte";
	import Ticker, { Mode as TickerMode } from "./Ticker.svelte";
	import { play as playSound, Sound } from "../lib/sound";
	import { get } from "svelte/store";

	export let settings: Settings;
	export let site: Site;
	export let state: AppState;
	export let board: Board;

	const access = site.access();
	const auth = site.auth;
	const cooldown = board.cooldown;
	const info = board.info;
	const token = auth.token;
	$: loggedIn = typeof $token === "string";

	const toggle = (panelMode: Panel) => {
		return () => {
			if (panel === panelMode) {
				panel = Panel.None;
			} else {
				panel = panelMode;
			}
		};
	};

	enum Panel {
		None,
		Place,
		Account,
		Factions,
		Templates,
		Settings,
	}

	let panel = Panel.None;

	let lastPixels = get(cooldown).pixelsAvailable;
	cooldown.subscribe((c) => {
		if (lastPixels < c.pixelsAvailable) {
			playSound(Sound.Cooldown);
		}
		lastPixels = c.pixelsAvailable;
	});
</script>
<style>
	.grid-5 {
		display: grid;
		grid-template-columns: 3fr 3fr minmax(6em, 2fr) 3fr 3fr;
	}

	.end {
		display: flex;
		flex-direction: column;
		justify-content: end;
	}

	.switcher-button {
		gap: 0.25em;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.switcher-button > small {
		display: block;
		line-height: 1.25em;
	}
</style>
<Grid maxwidth="53em" maxheight="100%">
	{#await $access then access}
		<div class="bottom-center flex vertical reverse panel">
			<nav class="grid-5 switcher">
				{#if loggedIn && access.has("users.current.get")}
					<button
						class="switcher-button"
						class:active={panel === Panel.Account}
						on:click={toggle(Panel.Account)}
					>
						<div class="icon large">👤</div>
						<small>Account</small>
					</button>
				{:else}
					<Login {auth} />
				{/if}
				{#if access.has("users.current.factions.list")}
					<button
						class="switcher-button"
						class:active={panel === Panel.Factions}
						on:click={toggle(Panel.Factions)}
					>
						<div class="icon large">👥</div>
						<small>Factions</small>
					</button>
				{:else}
					<div></div>
				{/if}
				{#if access.has("boards.pixels.post")}
					<button
						class="switcher-button"
						class:active={panel === Panel.Place}
						on:click={toggle(Panel.Place)}
					>
						{#if $cooldown.pixelsAvailable > 0}
							<div class="icon large">🖌️</div>
							<small>
								<Pixelstack
									count={$cooldown.pixelsAvailable}
									max={$info.maxPixelsAvailable}
								/>
							</small>
						{:else if typeof $cooldown.nextTimestamp !== "undefined"}
							<div class="icon large"><Ticker mode={TickerMode.Clock}/></div>
							<small>
								<Time
									time={$cooldown.nextTimestamp}
									mode={TimeMode.Relative}
								/>
							</small>
						{/if}
					</button>
				{:else}
					<button class="switcher-button" disabled={true}>
						<div class="icon large">🔒</div>
						<small>Login to Play</small>
					</button>
				{/if}
				<button
					class="switcher-button"
					class:active={panel === Panel.Templates}
					on:click={toggle(Panel.Templates)}
				>
					<div class="icon large">📐</div>
					<small>Templates</small>
				</button>
				<button
					class="switcher-button"
					class:active={panel === Panel.Settings}
					on:click={toggle(Panel.Settings)}
				>
					<div class="icon large">🔧</div>
					<small>Settings</small>
				</button>
			</nav>

			{#if panel === Panel.Place}
				<div class="drawer">
					<Palette bind:state {board} />
				</div>
			{/if}
		</div>
		{#if panel === Panel.Account}
			<div class="glass left"></div>
			<div class="center-center drawer flex vertical padded">
				<Account {site} {auth} {access} />
			</div>
			<div class="glass right"></div>
		{:else if panel === Panel.Factions}
			<div class="glass left"></div>
			<div class="center-center drawer flex vertical padded">
				<FactionsPanel {access} {site}/>
			</div>
			<div class="glass right"></div>
		{:else if panel === Panel.Place}
			<div class="center-center cursor-transparent end">
				<Tools {board} {access} bind:state bind:settings />
			</div>
		{:else if panel === Panel.Templates}
			<div class="glass left"></div>
			<div class="center-center drawer flex vertical padded">
				<Templates {board} bind:templates={board.templates} bind:selectedStyle={settings.template.style} />
			</div>
			<div class="glass right"></div>
		{:else if panel === Panel.Settings}
			<div class="glass left"></div>
			<div class="center-center drawer flex vertical padded">
				<SettingsPanel bind:settings />
			</div>
			<div class="glass right"></div>
		{/if}
	{/await}
</Grid>
