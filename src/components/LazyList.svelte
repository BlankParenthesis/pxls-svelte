<script lang="ts" generics="T">
	export let itemSource: AsyncGenerator<T>;
	export let batchSize = 20;

	let items: Array<T>;
	// when the source changes, reset
	$: if (itemSource) {
		items = [];
		loadMore();
	}

	let done = false;

	async function loadMore() {
		for (let i = 0; i < batchSize; i++) {
			const next = await itemSource.next();
			if (next.done) {
				done = true;
				return;
			}
			items = [...items, next.value];
		}
	}
</script>
<style>
</style>
<ul>
	{#each items as item}
		<slot {item} />
	{/each}
	{#if !done}
		<button on:click={loadMore}>Load More</button>
	{/if}
</ul>
