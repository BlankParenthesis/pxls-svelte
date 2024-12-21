<script lang="ts">
    import type { Readable } from "svelte/store";
    import { Role as RawRole } from "../lib/role";
    import Role from "./Role.svelte";

	export let roles: Readable<Promise<Array<Readable<Promise<RawRole> | undefined>>>>;
</script>
<style>
</style>
{#await $roles}
	Loading Roles
{:then roles}
	<ul class="roles flex wrap">
		{#each roles as role}
			<Role {role} />
		{/each}
	</ul>
{/await}
