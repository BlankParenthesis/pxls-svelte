<script context="module" lang="ts">
	const MOUSE_BUTTON_PRIMARY = 1;
	const MOUSE_BUTTON_SECONDARY = 2;
	const MOUSE_BUTTON_AUXILIARY = 4;
	const MOUSE_BUTTON_FOUR = 8;
	const MOUSE_BUTTON_FIVE = 16;
</script>
<script lang="ts">
	import { onMount } from "svelte";
	import { Canvas } from "./canvas";
	import { Vec2 } from "ogl-typescript";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	let renderIdentity = false;
	let autoDetail = false;
	let detailLevel = 0;
	let scaleBase = 3;

	$: renderOptions = {
		renderIdentity,
		autoDetail,
		detailLevel,
		scaleBase,
	};

	$: dummy = canvas && canvas.render(renderOptions)
		&& (renderOptions = renderOptions);

	function drag(event: MouseEvent) {
		if (event.buttons & MOUSE_BUTTON_PRIMARY) {
			canvas.translate[0] += 2 * event.movementX / canvasElement.width / canvas.scale[0];
			canvas.translate[1] += -2 * event.movementY / canvasElement.height / canvas.scale[1];
			canvas.render(renderOptions);
		}
	}

	function zoom(event: WheelEvent) {
		const oldScale = new Vec2(canvas.scale[0], canvas.scale[1]);

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

		canvas.scale[0] *= 1.15 ** delta;
		canvas.scale[1] *= 1.15 ** delta;

		const zoomCenterX = 2 * (event.clientX / canvasElement.width) - 1;
		const zoomCenterY = -2 * (event.clientY / canvasElement.height) + 1;
		
		canvas.translate[0] -= zoomCenterX / oldScale[0];
		canvas.translate[0] += zoomCenterX / canvas.scale[0];
		canvas.translate[1] -= zoomCenterY / oldScale[1];
		canvas.translate[1] += zoomCenterY / canvas.scale[1];
		
		canvas.render(renderOptions);
	}

	function resize() {
		canvas.setSize(window.innerWidth, window.innerHeight);
		canvas.render(renderOptions);
	}

	onMount(() => {
		canvas = new Canvas(canvasElement);
		resize();
	})
</script>

<svelte:window on:resize="{resize}" />

<canvas on:mousemove="{drag}" on:wheel="{zoom}" bind:this={canvasElement} />
<aside id="buttons">
	<div>
		<output>Subdivisions: {scaleBase - 1}</output>
		<button on:click="{() => scaleBase += 1}">+</button>
		<button on:click="{() => scaleBase -= 1}">-</button>
	</div>
	<div>
		<output><abbr title="Level of Detail">LoD</abbr>: {renderOptions.detailLevel}</output>
		<label><input bind:checked="{autoDetail}" type="checkbox"/>Auto LoD</label>
		<button disabled="{autoDetail}" on:click="{() => detailLevel += 1}">+</button>
		<button disabled="{autoDetail}" on:click="{() => detailLevel -= 1}">-</button>
	</div>
	<div>
		<label><input bind:checked="{renderIdentity}" type="checkbox"/>Show Reference</label>
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
</style>