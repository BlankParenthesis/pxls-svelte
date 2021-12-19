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
	let autoDetail = true;
	let detailLevel = 1;
	let outline = 0.05;
	let outlineStripe = 8;

	$: renderOptions = {
		renderIdentity,
		autoDetail,
		detailLevel,
		outline,
		outlineStripe,
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
		<label>Loaded Data:</label>
		<div class="vertical">
			<label>LoD 0</label>
			<div class="grid one-by-one">
				<input type="checkbox" on:click="{(e) => canvas.setSampler(0, 0, 0, e.target.checked ? "./canvas.png" : null)}" />
			</div>
		</div>
		<div class="vertical">
			<label>LoD 1</label>
			<div class="grid two-by-two">
				<input type="checkbox" on:click="{(e) => canvas.setSampler(1, 0, 0, e.target.checked ? "./canvas_tl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(1, 1, 0, e.target.checked ? "./canvas_tr.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(1, 0, 1, e.target.checked ? "./canvas_bl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(1, 1, 1, e.target.checked ? "./canvas_br.png" : null)}" />
			</div>
		</div>
		<div class="vertical">
			<label>LoD 2</label>
			<div class="grid four-by-four">
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 0, 0, e.target.checked ? "./canvas_tl_tl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 1, 0, e.target.checked ? "./canvas_tl_tr.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 2, 0, e.target.checked ? "./canvas_tr_tl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 3, 0, e.target.checked ? "./canvas_tr_tr.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 0, 1, e.target.checked ? "./canvas_tl_bl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 1, 1, e.target.checked ? "./canvas_tl_br.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 2, 1, e.target.checked ? "./canvas_tr_bl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 3, 1, e.target.checked ? "./canvas_tr_br.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 0, 2, e.target.checked ? "./canvas_bl_tl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 1, 2, e.target.checked ? "./canvas_bl_tr.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 2, 2, e.target.checked ? "./canvas_br_tl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 3, 2, e.target.checked ? "./canvas_br_tr.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 0, 3, e.target.checked ? "./canvas_bl_bl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 1, 3, e.target.checked ? "./canvas_bl_br.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 2, 3, e.target.checked ? "./canvas_br_bl.png" : null)}" />
				<input type="checkbox" on:click="{(e) => canvas.setSampler(2, 3, 3, e.target.checked ? "./canvas_br_br.png" : null)}" />
			</div>
		</div>
	</div>
	<!--<div>
		<output>Subdivisions: {scaleBase - 1}</output>
		<button on:click="{() => scaleBase += 1}">+</button>
		<button on:click="{() => scaleBase -= 1}">-</button>
	</div>-->
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