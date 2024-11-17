<script lang="ts">
	import type { UserCount } from "../lib/usercount";

	export let count: Promise<UserCount>;
</script>
<span>Users Online:
	{#await count}
		Loading…
	{:then userCount}
		{userCount.active}
	{/await}
</span>