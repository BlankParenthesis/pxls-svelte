<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { FactionMember } from "../lib/factionmember";
	import type { Faction } from "../lib/faction";
	import { Reference } from "../lib/reference";
	import FactionStatusInternal from "./FactionStatusInternal.svelte";

	export let faction: Faction;
	export let member: Readable<Promise<Reference<FactionMember> | undefined>>;
	export let access: Set<string>;
</script>
<style>
</style>
{#await $member}
	Loading Faction Membership
{:then member}
	<FactionStatusInternal {faction} member={member?.fetch()} {access} />
{/await}
