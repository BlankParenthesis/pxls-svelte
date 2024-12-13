<script lang="ts">
    import type { Readable } from "svelte/store";
	import type { UserCount } from "../lib/usercount";

	export let count: Readable<Promise<UserCount>>;
</script>
<span>Users Online:
	{#await $count}
		Loading…
	{:then userCount}
		{userCount.active}
	{/await}
</span>
