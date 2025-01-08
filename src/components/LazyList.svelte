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
	ul {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
</style>
<ul class="item-list">
	{#each items as item}
		<li><slot {item} /></li>
	{:else}
		<slot name="empty" />
	{/each}
	{#if !done}
		<button on:click={loadMore}>Load More</button>
	{/if}
</ul>
