<script lang="ts">
	import type { Readable } from "svelte/store";
	import { Role } from "../lib/role";
	import RoleDisplay from "./Role.svelte";
	import Unwrap from "./Unwrap.svelte";

	export let roles: Array<Readable<Promise<Role> | undefined>>;
</script>
<style>
</style>
<ul class="roles flex wrap">
	{#each roles as role}
		<Unwrap store={role} let:value>
			{#await value then role}
				{#if typeof role !== "undefined"}
					<li><RoleDisplay {role} /></li>
				{/if}
			{/await}
		</Unwrap>
	{/each}
</ul>
