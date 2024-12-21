<script lang="ts">
    import type { Readable } from "svelte/store";
    import { MemberStatus, type FactionMember } from "../lib/factionmember";
    import type { Faction } from "../lib/faction";

	export let faction: Faction;
	export let member: Readable<Promise<FactionMember | undefined> | undefined>;
</script>
<style>
</style>
<span>
	{#await $member}
		Loading Faction Membership
	{:then member}
		{#if typeof member === "undefined" || member.status === MemberStatus.None}
			<button on:click="{() => faction.join()}">Join</button>
		{:else if member.status === MemberStatus.Owned}
			<span>Owner</span>
		{:else if member.status === MemberStatus.Applied}
			<button>Retract Application</button>
		{:else if member.status === MemberStatus.Invited}
			<button>Accept Invite</button>
		{:else if member.status === MemberStatus.Joined}
			<button on:click="{() => member.leave()}">Leave</button>
		{/if}
	{/await}
</span>
