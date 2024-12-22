<script lang="ts">
	export let x: number;
	export let y: number;
	export let width: number;
	export let height: number;
</script>
<style>
	.exact-position {
		position: absolute;
	}
</style>
<div
	class="exact-position cursor-transparent"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{width}px"
	style:height="{height}px"
>
	<slot></slot>
</div>
