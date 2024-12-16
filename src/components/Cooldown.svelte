<script lang="ts" context="module">
	import { writable, type Readable } from "svelte/store";

	let internalNow = writable(Date.now());
	setInterval(() => internalNow.set(Date.now()), 1000);
	export let now = { subscribe: internalNow.subscribe } as Readable<number>;
</script>
<script lang="ts">
	import type { Cooldown } from "../lib/board/board";
	import type { BoardInfo } from "../lib/board/info";

	export let cooldown: Cooldown;
	export let info: BoardInfo;
</script>
<span>Pixels: {cooldown.pixelsAvailable} of {info.maxPixelsAvailable}</span>
{#if typeof cooldown.nextTimestamp !== "undefined"}
	<time datetime={new Date(cooldown.nextTimestamp * 1000).toISOString()}>
		{Math.ceil(cooldown.nextTimestamp - $now / 1000)}s
	</time>
{/if}
