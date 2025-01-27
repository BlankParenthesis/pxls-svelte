<style>
	.bubble {
		position: absolute;
		/* 1em = the height of the arrow */
		bottom: calc(100% + 1em);
		left: 50%;
		transform: translateX(-50%);
		max-width: 12em;
		/* 4em = 2×the width of the arrow */
		min-width: 4em;
		box-sizing: content-box;
		border-style: solid;
		border-width: 2px;
		padding: .5em;
		border-radius: 0.5em;
		text-align: center;
		color: var(--bubble-color);
		border-color: var(--bubble-background);
		background: var(--bubble-background);
		box-shadow: 0 2px 5px #00000077;
		/*
			Hack to allow the element to grow up the specified max size rather
			than constrain itself to the parent.
		*/
		margin-right: -12em;
	}

	.arrow, .arrow-shadow {
		position: absolute;
		bottom: calc(100% + 1em);
		left: 50%;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.arrow::after, .arrow-shadow::before {
		content: "";
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		border-style: solid;
		border-bottom-style: none;
		border-left-width: 2em;
		border-right-width: 2em;
		border-top-width: 1em;
		border-color: transparent;
	}

	/* the shadow */
	.arrow-shadow::before {
		top: calc(100% + 2px);
		border-top-color: #00000077;
		filter: blur(5px);
	}

	/* the arrow itself */
	.arrow::after {
		top: 100%;
		border-top-color: var(--bubble-background);
	}
</style>
<div class="arrow-shadow"></div>
<div class="bubble fully-cursor-transparent">
	<slot />
</div>
<div class="arrow"></div>
