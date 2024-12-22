<style>
	.stack {
		position: relative;
	}
	.stack > :global(*) {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
</style>
<div class="stack">
	<slot></slot>
</div>
