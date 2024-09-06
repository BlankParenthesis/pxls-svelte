<script lang="ts">
    import type { User } from "../lib/user";
    import Roles from "./Roles.svelte";
    import Time from "./Time.svelte";

	export let user: User;
	export let access: Set<string>;
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
		{#if access.has("users.current.roles.get")}
			<Roles roles={user.roles()} />
		{/if}
		<div class="no-shrink">
			Joined <Time time={user.createdAt} />
		</div>
	</div>
</section>
