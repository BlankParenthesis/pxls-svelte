<script lang="ts">
	import type { Faction } from "../lib/faction";
	import Time from "./Time.svelte";
	import FactionStatus from "./FactionStatus.svelte";
	import IconPlaceholder from "./IconPlaceholder.svelte";
	import Unwrap from "./Unwrap.svelte";

	export let faction: Faction;
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
	<div class="flex gap">
		<!-- TODO: use an actual icon -->
		<IconPlaceholder label={faction.name} randomness={faction.uri.toString()} />
		<div class="grow flex vertical">
			<div class="flex space">
				<h5 class="truncate">{faction.name}</h5>
				{#if access.has("factions.members.get")}
					<Unwrap store={faction.currentMember()} let:value>
						{#await value}
							<p>Loading Memership…</p>
						{:then memberId}
							{#if typeof memberId === "undefined"}
								<FactionStatus {faction} {access} member={undefined} />
							{:else}
								<Unwrap store={faction.members.fetch(memberId)} let:value>
									{#await value}
										<p>Loading Memership…</p>
									{:then member}
										<FactionStatus {faction} {access} {member} />
									{/await}
								</Unwrap>
							{/if}
						{/await}
					</Unwrap>
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
</div>
