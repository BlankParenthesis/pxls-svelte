<style>
	.stack {
		position: relative;
	}
	.stack > :global(*) {
		position: absolute;
		inset: 0;
	}
</style>
<div class="stack">
	<slot></slot>
</div>