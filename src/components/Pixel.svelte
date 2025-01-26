<script lang="ts">
	import { Pixel } from "../lib/pixel";
	import Time, { Mode as TimeMode } from "./Time.svelte";
	import Unwrap from "./Unwrap.svelte";

	export let pixel: Pixel | undefined;
</script>
<style>
	p {
		margin: 0.25em;
	}
</style>
{#if typeof pixel === "undefined"}
	<p>Never placed</p>
{:else}
	{#if typeof pixel.user !== "undefined"}
		<Unwrap store={pixel.user} let:value>
			{#await value}
				<p>Loading user info…</p>
			{:then user}
				{#if typeof user !== "undefined"}
					<p>{user.name}</p>
				{/if}
			{/await}
		</Unwrap>
	{/if}
	<p><Time time={pixel.modified} mode={TimeMode.Relative} /></p>
{/if}
