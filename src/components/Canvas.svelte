<script context="module" lang="ts">
	const MOUSE_BUTTON_PRIMARY = 1;
	const MOUSE_BUTTON_SECONDARY = 2;
	const MOUSE_BUTTON_AUXILIARY = 4;
	const MOUSE_BUTTON_FOUR = 8;
	const MOUSE_BUTTON_FIVE = 16;
</script>
<script lang="ts">
	import { Texture } from "ogl-typescript";
	import { onMount } from "svelte";
	import type { Board } from "../lib/canvas/backend/backend";
	//import { FakeBackend } from "../lib/canvas/backend/fakebackend";
	import { PxlsRsBackend } from "../lib/canvas/backend/pxlsrsbackend";
	import { Canvas } from "../lib/canvas/canvas";
	import { Template } from "../lib/canvas/template";
    import { type RenderSettings } from "../lib/settings";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	export let renderOptions: RenderSettings;

	$: if (canvas) {
		canvas.render(renderOptions)
			.catch(console.error);
	}

	async function drag(event: MouseEvent) {
		if (event.buttons & MOUSE_BUTTON_PRIMARY) {
			if (event.altKey || event.ctrlKey) {
				// FIXME: multiple events could play out of order here since there's no sync.
				// Also, no feedback on movement could be bad for UX.
				const [width, height] = await canvas.size();
				renderOptions.templates[0].x += width * 2 * event.movementX / canvasElement.width / canvas.scale[0];
				renderOptions.templates[0].y += height * 2 * event.movementY / canvasElement.height / canvas.scale[1];
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
		//const backend = new FakeBackend();
		const backend = new PxlsRsBackend(new URL("http://localhost:45632/"));

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
			width: 20,
			height: 20,
			format: canvas.gl.LUMINANCE,
			internalFormat: canvas.gl.LUMINANCE,
			minFilter: canvas.gl.NEAREST,
			magFilter: canvas.gl.NEAREST,
		}));
		template.x = 5;
		template.y = 2;
		canvas.gl.pixelStorei(canvas.gl.UNPACK_ALIGNMENT, 4);
		renderOptions.templates.push(template);
		await resize();
	})
</script>

<svelte:window on:resize="{resize}" />

<canvas on:mousemove="{drag}" on:wheel="{zoom}" bind:this="{canvasElement}" />
