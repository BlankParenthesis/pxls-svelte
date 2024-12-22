<script lang="ts">
	import type { Readable } from "svelte/store";
	import type { User } from "../lib/user";

	export let user: Readable<Promise<User> | undefined>;
</script>
<style>
</style>
{#await $user}
	Loading user info…
{:then user}
	{#if typeof user !== "undefined"}
		{user.name}
	{/if}
{/await}
