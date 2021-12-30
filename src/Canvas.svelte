<script context="module" lang="ts">
	const MOUSE_BUTTON_PRIMARY = 1;
	const MOUSE_BUTTON_SECONDARY = 2;
	const MOUSE_BUTTON_AUXILIARY = 4;
	const MOUSE_BUTTON_FOUR = 8;
	const MOUSE_BUTTON_FIVE = 16;
</script>
<script lang="ts">
	import { Texture, Vec2 } from "ogl-typescript";
	import { onMount } from "svelte";
	import type { Board } from "./backend/backend";
	import { FakeBackend } from "./backend/fakebackend";
	import { Canvas, DEFAULT_RENDER_SETTINGS, RenderSettings } from "./canvas";
	import { Template } from "./template";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	let autoDetail = DEFAULT_RENDER_SETTINGS.autoDetail;
	let detailLevel = DEFAULT_RENDER_SETTINGS.detailLevel;
	let templates = DEFAULT_RENDER_SETTINGS.templates;
	let timestampStart = DEFAULT_RENDER_SETTINGS.timestampRange[0];
	let timestampEnd = DEFAULT_RENDER_SETTINGS.timestampRange[1];
	$: timestampRange = new Vec2(timestampStart, timestampEnd);
	let heatmapDim = DEFAULT_RENDER_SETTINGS.heatmapDim

	$: renderOptions = {
		autoDetail,
		detailLevel,
		templates,
		timestampRange,
		heatmapDim,
	};

	$: if (canvas) {
		canvas.render(renderOptions as RenderSettings)
			.catch(console.error);
		renderOptions = renderOptions;
	}

	function drag(event: MouseEvent) {
		if (event.buttons & MOUSE_BUTTON_PRIMARY) {
			if (event.altKey || event.ctrlKey) {
				templates[0].x += canvas.width * 2 * event.movementX / canvasElement.width / canvas.scale[0];
				templates[0].y += canvas.height * 2 * event.movementY / canvasElement.height / canvas.scale[1];
			} else {
				canvas.translate[0] += 2 * event.movementX / canvasElement.width / canvas.scale[0];
				canvas.translate[1] += -2 * event.movementY / canvasElement.height / canvas.scale[1];
			}
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

	async function resize() {
		await canvas.setSize(window.innerWidth, window.innerHeight);
		canvas = canvas;
	}

	onMount(async () => {
		const backend = new FakeBackend();

		let board: Board | null = null;
		for await (const choice of backend.availableBoards()) {
			board = await choice.connect();
			break;
		}
		
		if(board === null) {
			throw new Error("Fake backend should produce at least one board");
		}

		const { shape } = await board.info();
		canvas = new Canvas(board, shape, canvasElement);
		canvas.gl.pixelStorei(canvas.gl.UNPACK_ALIGNMENT, 1);
		const template = new Template(new Texture(canvas.gl, {
			image: new Uint8Array(new Array(200 * 200).fill(1).map((_, i) => i % 4)),
			width: 200,
			height: 200,
			format: canvas.gl.LUMINANCE,
			internalFormat: canvas.gl.LUMINANCE,
			minFilter: canvas.gl.NEAREST,
			magFilter: canvas.gl.NEAREST,
		}));
		template.x = 10;
		template.y = 100;
		canvas.gl.pixelStorei(canvas.gl.UNPACK_ALIGNMENT, 4);
		templates.push(template);
		await resize();
	})
</script>

<svelte:window on:resize="{resize}" />

<canvas on:mousemove="{drag}" on:wheel="{zoom}" bind:this="{canvasElement}" />
<aside id="buttons">
	<div class="vertical">
		<label>Heatmap Start<input type="range" min="0" max="3000" bind:value="{timestampStart}"/></label>
		<label>Heatmap End<input type="range" min="0" max="3000" bind:value="{timestampEnd}"/></label>
		<label>Heatmap Dimming<input type="range" min="0" max="1" step="0.01" bind:value="{heatmapDim}"/></label>
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
		align-items: flex-end;
	}
</style>