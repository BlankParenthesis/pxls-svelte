<script lang="ts">
	import { Site } from "../lib/site";
	import FactionsList from "./FactionsList.svelte";
	import FactionsSearch from "./FactionsSearch.svelte";
	import IconPlaceholder from "./IconPlaceholder.svelte";
	import Unwrap from "./Unwrap.svelte";

	export let access: Set<string>;
	export let site: Site;

	let newFaction: { name: string } | undefined;
	let newFactionForm: HTMLFormElement;
	let creatingFaction = false;

	async function createFaction() {
		if (creatingFaction || typeof newFaction === "undefined") {
			return;
		}
		creatingFaction = true;

		await site.createFaction(newFaction);

		creatingFaction = false;
		newFaction = undefined;
	}
</script>
<style>
	.new-faction {
		padding: 1em;
		margin: 1em 0;
		background: var(--item-background);
		border: var(--item-border);
		border-top: none;
		box-shadow: var(--item-shadow);
		border-radius: 1em;
	}
</style>
<h2>Factions</h2>
<Unwrap store={site.currentUser()} let:value>
	{#await value}
		<p>Finding Current User…</p>
	{:then userReference}
		<Unwrap store={userReference.fetch()} let:value>
			{#await value}
				<p>Loading User Info…</p>
			{:then user}
				{#if typeof user !== "undefined"}
					<section>
						<h3>Your Factions</h3>
						<Unwrap store={user.factions()} let:value>
							{#await value}
								<li>Loading Faction…</li>
							{:then factions}
								{#if typeof factions !== "undefined"}
									<FactionsList {factions} {access} />
								{/if}
							{/await}
						</Unwrap>
						{#if access.has("factions.post")}
							{#if typeof newFaction === "undefined"}
								<p class="flex center-all">
									<button
										on:click={() => newFaction = { name: "" }}
										class="button large suggested"
									>Create Faction</button>
								</p>
							{:else}
								<h4>New Faction</h4>
								<form bind:this={newFactionForm} class="new-faction">
									<div class="flex gap align-middle">
										<IconPlaceholder label={newFaction.name} randomness={""} />
										<div class="grow flex vertical">
											<div class="flex">
												<label class="flex fullwidth wrap text">
													<input
														type="text"
														name="faction-name"
														bind:value={newFaction.name}
														placeholder="Faction name"
														required={true}
														class="grow"
													/>
												</label>
											</div>
											<div class="flex space gap">
											</div>
										</div>
										<button
											disabled={creatingFaction}
											on:click={(e) => {
												if (newFactionForm.checkValidity()) {
													createFaction();
													e.preventDefault();
												} else {
													newFactionForm.reportValidity();
												}
											}}
											class="button suggested"
										>Create</button>
									</div>
								</form>
							{/if}
						{/if}
					</section>
				{/if}
			{/await}
		</Unwrap>
	{/await}
</Unwrap>
{#if access.has("factions.list")}
	<section>
		<h3>Available Factions</h3>
		<FactionsSearch {site} {access} />
	</section>
{/if}
