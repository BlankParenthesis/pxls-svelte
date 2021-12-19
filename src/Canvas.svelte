<script context="module" lang="ts">
	const MOUSE_BUTTON_PRIMARY = 1;
	const MOUSE_BUTTON_SECONDARY = 2;
	const MOUSE_BUTTON_AUXILIARY = 4;
	const MOUSE_BUTTON_FOUR = 8;
	const MOUSE_BUTTON_FIVE = 16;
</script>
<script lang="ts">
	import { onMount } from "svelte";
	import { Canvas, DEFAULT_SHAPE, DEFAULT_RENDER_SETTINGS, Shape, RenderSettings } from "./canvas";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	let renderIdentity = DEFAULT_RENDER_SETTINGS.renderIdentity;
	let autoDetail = DEFAULT_RENDER_SETTINGS.autoDetail;
	let detailLevel = DEFAULT_RENDER_SETTINGS.detailLevel;
	let outline = DEFAULT_RENDER_SETTINGS.outline;
	let outlineStripe = DEFAULT_RENDER_SETTINGS.outlineStripe;
	let shapeValid = true;

	$: renderOptions = {
		renderIdentity,
		autoDetail,
		detailLevel,
		outline,
		outlineStripe,
	};

	function updateShape(shape: string) {
		try {
			const parsed = JSON.parse(shape) as unknown;
			if (!Array.isArray(parsed)) {
				throw new Error();
			}
			if (!parsed.every(e => Array.isArray(e)
				&& e.length === 2
				&& e.every(n => typeof n === "number"))
			) {
				throw new Error();
			}
			
			shapeValid = true;
			canvas.reshape(parsed as Shape);
			canvas.render(renderOptions as RenderSettings);
		} catch(e) {
			shapeValid = false;
		}
	}

	$: if (canvas) {
		canvas.render(renderOptions as RenderSettings);
		renderOptions = renderOptions;
	}

	function drag(event: MouseEvent) {
		if (event.buttons & MOUSE_BUTTON_PRIMARY) {
			canvas.translate[0] += 2 * event.movementX / canvasElement.width / canvas.scale[0];
			canvas.translate[1] += -2 * event.movementY / canvasElement.height / canvas.scale[1];
		}
	}

	function zoom(event: WheelEvent) {
		const oldScaleX = canvas.scale[0];
		const oldScaleY = canvas.scale[1];

		let delta = -event.deltaY;

		switch (event.deltaMode) {
			case WheelEvent.DOM_DELTA_PIXEL:
				// 53 pixels is the default chrome gives for a wheel scroll.
				delta /= 53;
				break;
			case WheelEvent.DOM_DELTA_LINE:
				// default case on Firefox, three lines is default number.
				delta /= 3;
				break;
			case WheelEvent.DOM_DELTA_PAGE:
				delta = Math.sign(delta);
				break;
		}

		canvas.zoomScale[0] *= 1.15 ** delta;
		canvas.zoomScale[1] *= 1.15 ** delta;

		const zoomCenterX = 2 * (event.clientX / canvasElement.width) - 1;
		const zoomCenterY = -2 * (event.clientY / canvasElement.height) + 1;
		
		canvas.translate[0] -= zoomCenterX / oldScaleX;
		canvas.translate[0] += zoomCenterX / canvas.scale[0];
		canvas.translate[1] -= zoomCenterY / oldScaleY;
		canvas.translate[1] += zoomCenterY / canvas.scale[1];
	}

	function resize() {
		canvas.setSize(window.innerWidth, window.innerHeight);
		canvas = canvas;
	}

	onMount(() => {
		canvas = new Canvas(canvasElement);
		resize();
	})
</script>

<svelte:window on:resize="{resize}" />

<canvas on:mousemove="{drag}" on:wheel="{zoom}" bind:this="{canvasElement}" />
<aside id="buttons">
	<div>
		<label>
			{#if !shapeValid }
			<span style="font-size: xxx-large; margin-right: 0.15em; margin-top:-.15em; line-height:.5em" title="Invalid shape">⚠</span>
			{/if}
			<span style="margin-right: 0.15em;">Shape</span>
			<input type="text" value="{JSON.stringify(DEFAULT_SHAPE)}" on:change="{e => updateShape(e.target.value)}" />
		</label>
	</div>
	<div>
		<output><abbr title="Level of Detail">LoD</abbr>: {renderOptions.detailLevel}</output>
		<label><input bind:checked="{autoDetail}" type="checkbox"/>Auto</label>
		<button disabled="{autoDetail}" on:click="{() => detailLevel += 1}">+</button>
		<button disabled="{autoDetail}" on:click="{() => detailLevel -= 1}">-</button>
	</div>
	<div>
		<label><input bind:checked="{renderIdentity}" type="checkbox"/>Show Reference</label>
	</div>
	<div>
		<label>Outline: <input bind:value="{outline}" type="range" min="0" step="0.01" max="1" /></label>
		<label>Stripes: <input bind:value="{outlineStripe}" type="number" min="2" step="1"/></label>
	</div>
</aside>

<style>
	aside {
		display: flex;
		flex-direction: column;
		position: absolute;
		top: .5em;
		right: .5em;
		gap: .5em;
	}

	aside > div {
		display: flex;
		align-items: center;
		justify-content: right;
		gap: .5em;
	}

	button, output, label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: x-large;
		font-weight: bold;
		font-family: monospace;
		padding:  .25em .5em;
	}

	output, label {
		background-color: aliceblue;
		border-style: outset;
		border-width: 1px;
		border-color: #77b;
		border-radius: .25em;
	}

	input[type="checkbox"] {
		margin-left: 0;
	}

	input[type="number"] {
		width: 3em;
	}

	.vertical {
		display: flex;
		flex-direction: column;
	}

	.grid {
		display: grid;
		align-self: center;
	}

	.one-by-one {
		grid-template-columns: 1fr;
	}

	.two-by-two {
		grid-template-columns: 1fr 1fr;
	}

	.four-by-four {
		grid-template-columns: 1fr 1fr 1fr 1fr;
	}
</style>