<script lang="ts">
	import type { Cooldown } from "../lib/board/board";
    import type { BoardInfo } from "../lib/board/info";

	export let cooldown: Cooldown;
	export let info: BoardInfo;
</script>
{#if cooldown.pixelsAvailable}
	Pixels: {cooldown.pixelsAvailable} of {info.max_pixels_available}
{/if}