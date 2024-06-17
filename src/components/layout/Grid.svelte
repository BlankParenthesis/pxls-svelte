<style>
	.grid {
		display: grid;
		grid-template-columns: minmax(2em, auto) 1fr minmax(2em, auto);
		grid-template-rows: minmax(2em, auto) 1fr minmax(2em, auto);
		grid-template-areas:
			"top-left     top     top-right"
			"left         center  right"
			"bottom-left  bottom  bottom-right";
		pointer-events: none;
	}

	.grid > :global(*) {
		pointer-events: initial;
	}

	.grid > :global(.top-left) { grid-area: top-left; }
	.grid > :global(.top) { grid-area: top; }
	.grid > :global(.top-right) { grid-area: top-right; }
	.grid > :global(.left) { grid-area: left; }
	.grid > :global(.center) { grid-area: center; }
	.grid > :global(.right) { grid-area: right; }
	.grid > :global(.bottom-left) { grid-area: bottom-left; }
	.grid > :global(.bottom) { grid-area: bottom; }
	.grid > :global(.bottom-right) { grid-area: bottom-right; }
</style>
<div class="grid">
	<slot></slot>
</div>