<script lang="ts">
	import type { Faction } from "../lib/faction";
	import Time from "./Time.svelte";
	import FactionStatus from "./FactionStatus.svelte";
	import IconPlaceholder from "./IconPlaceholder.svelte";

	export let faction: Promise<Faction>;
	export let access: Set<string>;
</script>
<style>
	h5 {
		font-size: medium;
		margin: 0;
	}

	.profile-icon {
		width: 3em;
		height: 3em;
		object-fit: cover;
	}
</style>
<div class="faction">
	{#await faction}
		Loading Faction
	{:then faction}
		{#if typeof faction !== "undefined"}
			<div class="flex gap">
				<!-- TODO: use an actual icon -->
				<IconPlaceholder label={faction.name} randomness={faction.uri.toString()} />
				<div class="grow flex vertical">
					<div class="flex space">
						<h5 class="truncate">{faction.name}</h5>
						{#if access.has("factions.members.get")}
							{#await faction.currentMember()}
								<span>Loading Faction Members</span>
							{:then member}
								<FactionStatus {faction} {member} {access} />
							{/await}
						{/if}
					</div>
					<div class="flex space gap">
						<span class="no-shrink">
							Created <Time time={faction.createdAt} />
						</span>
						<span class="no-shrink">
							{faction.size} Members
						</span>
					</div>
				</div>
			</div>
		{/if}
	{/await}
</div>
