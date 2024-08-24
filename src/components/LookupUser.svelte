<script lang="ts">
    import type { Readable } from "svelte/store";
    import type { User } from "../lib/user";
    import Roles from "./Roles.svelte";
    import Time from "./Time.svelte";

	export let user: Readable<Promise<User>>;
</script>
<style>
	h3 {
		margin: 0;
	}
</style>
{#await $user}
	Loading user info…
{:then user}
	<h3>{user.name}</h3>
	<div class="flex space top">
		<Roles roles={user.roles()} />
		<div class="no-shrink">
			Joined <Time time={user.createdAt} />
		</div>
	</div>
{/await}
