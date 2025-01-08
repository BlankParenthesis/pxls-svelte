<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { Faction } from "../lib/faction";
	import Time from "./Time.svelte";
	import FactionStatus from "./FactionStatus.svelte";

	export let faction: Readable<Promise<Faction> | undefined>;
	export let access: Set<string>;

	function iconPlaceholder(name: string): string {
		return name.split(/ +/g)
			.filter(s => s.length > 0)
			.map(s => s[0])
			.join("")
			.toUpperCase();
	}

	// https://developer.gnome.org/hig/reference/palette.html
	const COLORS = [
		"#3584e4",
		"#33d17a",
		"#f6d32d",
		"#ff7800",
		"#e01b24",
		"#9141ac",
		"#986a44",
	];

	function colorPlaceholder(uri: URL): string {
		// sum the codepoints; this is random enough
		const random = uri.toString()
			.split("")
			.map(c => c.codePointAt(0) as number)
			.reduce((a, b) => a + b, 0);
		return COLORS[random % COLORS.length];
	}
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
		/* TODO: use an actual icon */
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #fff;
		font-weight: bold;
	}
</style>
<div class="faction">
	{#await $faction}
		Loading Faction
	{:then faction}
		{#if typeof faction !== "undefined"}
			<div class="flex gap">
				<div class="no-shrink profile-icon" style:background="{colorPlaceholder(faction.uri)}">
					{iconPlaceholder(faction.name)}
				</div>
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
