<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { Role } from "../lib/role";

	export let role: Readable<Promise<Role> | undefined>;
</script>
<style>
	.role {
		padding: 0.125em .75em;
		border-radius: .75em;
		border: 1px solid black;
	}
</style>
<li class="role">
	{#await $role}
		Loading Role
	{:then role}
		{#if typeof role !== "undefined"}
			{role.name}
		{:else}
			Error loading role
		{/if}
	{/await}
</li>
