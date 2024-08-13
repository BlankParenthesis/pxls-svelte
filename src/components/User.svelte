<script lang="ts">
    import type { User } from "../lib/user";
    import Role from "./Role.svelte";

	export let user: User;

	const roles = user.roles();
</script>
<style>
	h3 {
		font-size: xx-large;
		margin: 0;
	}
</style>
<section class="user">
	<h3>{user.name}</h3>
	<div class="flex space top">
		{#await $roles}
			Loading Roles
		{:then roles}
			<ul class="roles flex wrap">
				{#each roles as role}
					<Role {role} />
				{/each}
			</ul>
		{/await}
		<div class="no-shrink">
			Joined <time datetime={user.createdAt.toISOString()}>{user.createdAt.toLocaleDateString()}</time>
		</div>
	</div>
</section>
