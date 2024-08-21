<script lang="ts">
    import type { Readable } from "svelte/store";
	import type { Authentication } from "../lib/authentication";
    import type { User } from "../lib/user";
	import Login from "./Login.svelte";
	import UserDisplay from "./User.svelte";
    import Factions from "./Factions.svelte";
    import type { Site } from "../lib/site";

	export let site: Site;
	export let auth: Authentication;
	export let user: Readable<Promise<User>>;
</script>
<style>
	h2 {
		font-size: medium;
		margin: 0;
	}
</style>
<div class="flex space middle">
	<h2>Account</h2>
	<Login {auth} />
</div>
{#await $user}
	<h3>Loading User Data</h3>
{:then user}
	<UserDisplay {user} />
	<div class="flex wrap-reverse space top scroll">
		<Factions {user} {site} />
		<!-- TODO: stats -->
	</div>
{/await}