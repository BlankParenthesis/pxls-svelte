<script lang="ts">
	export let maxwidth = "auto";
	export let maxheight = "auto";
</script>
<style>
	.grid {
		display: grid;
		grid-template-areas:
			"top-left     top     top-right"
			"left         center  right"
			"bottom-left  bottom  bottom-right";
		pointer-events: none;
		grid-template-columns: 1fr minmax(0, var(--maxwidth)) 1fr;
		grid-template-rows: 1fr minmax(0, var(--maxheight)) 1fr;
	}

	.grid > :global(*) {
		pointer-events: initial;
	}

	.grid > :global(.top-left) { grid-area: top-left; }
	.grid > :global(.top-center) { grid-area: top; }
	.grid > :global(.top-right) { grid-area: top-right; }
	.grid > :global(.center-left) { grid-area: left; }
	.grid > :global(.center-center) { grid-area: center; }
	.grid > :global(.center-right) { grid-area: right; }
	.grid > :global(.bottom-left) { grid-area: bottom-left; }
	.grid > :global(.bottom-center) { grid-area: bottom; }
	.grid > :global(.bottom-right) { grid-area: bottom-right; }
	
	.grid > :global(.top) { grid-area: auto / top-left / auto / top-right; }
	.grid > :global(.middle) { grid-area: auto / top-left / auto / top-right; }
	.grid > :global(.bottom) { grid-area: auto / bottom-left / auto / bottom-right; }
	
	.grid > :global(.left) { grid-area: top-left / top-left / bottom-left / auto; }
	.grid > :global(.center) { grid-area: top / top / bottom / auto; }
	.grid > :global(.right) { grid-area: top-right / top-right / bottom-right / auto; }
</style>
<div class="grid" style="--maxwidth: {maxwidth}; --maxheight: {maxheight}">
	<slot></slot>
</div>