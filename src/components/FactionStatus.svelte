<script lang="ts">
	import { MemberStatus, type FactionMember } from "../lib/factionmember";
	import type { Faction } from "../lib/faction";

	export let faction: Faction;
	export let member: FactionMember | undefined;
	export let access: Set<string>;

	let deleteConfirm = false;
	async function deleteFaction() {
		if (deleteConfirm) {
			await faction.delete();
			deleteConfirm = false;
		} else {
			deleteConfirm = true;
		}
	}
</script>
<style>
</style>
<div class="flex gap">
	{#if typeof member === "undefined" || member.status === MemberStatus.None}
		{#if access.has("factions.members.post")}
			<button class="button" on:click="{() => faction.join()}">Join</button>
		{/if}
	{:else if member.status === MemberStatus.Owned}
		<span>Owner</span>
	{:else if member.status === MemberStatus.Applied}
		<button>Retract Application</button>
	{:else if member.status === MemberStatus.Invited}
		<button>Accept Invite</button>
	{:else if member.status === MemberStatus.Joined}
		{#if access.has("factions.members.delete")}
			<button class="button destructive" on:click="{() => member.leave()}">Leave</button>
		{/if}
	{/if}
	{#if access.has("factions.delete")}
		<button class="button destructive" on:click="{deleteFaction}">
			{#if deleteConfirm}
				Really Delete?
			{:else}
				Delete
			{/if}
		</button>
	{/if}
</div>
