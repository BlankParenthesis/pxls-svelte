<script lang="ts">
	import { onMount } from "svelte";
	import { get, writable, type Readable } from "svelte/store";
	import type { Board } from "../lib/board/board";
	import { Canvas, ViewBox, type RenderParameters } from "../lib/render/canvas";
	import { type RendererOverrides } from "../lib/settings";
	import { Vec2 } from "ogl";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	export let board: Board;
	export let overrides: RendererOverrides;
	export let parameters: RenderParameters;

	export let size: Vec2;
	export let templateStyle: HTMLImageElement;

	const aspectwrite = writable(new Vec2(1, 1));

	export const aspect = { subscribe: aspectwrite.subscribe } as Readable<Vec2>;

	export function getElement() {
		return canvasElement;
	}

	$: if (canvas && size) {
		canvas.setSize(size.x, size.y);
		aspectwrite.set(canvas.getAspect());
		paint();
	}

	export function paint() {
		if (canvas) {
			return canvas.render(parameters, overrides);
		} else {
			return ViewBox.default();
		}
	}

	const info = board.info;

	onMount(async () => {
		// TODO: pass and use the info store directly
		const i = get(info);
		canvas = new Canvas(board, i.shape, i.palette, canvasElement, templateStyle);
		canvas.onUpdate(() => paint());
	});
</script>
<style>
	canvas {
		touch-action: none;
	}
</style>
<canvas
	bind:this="{canvasElement}"
	on:pointerenter
	on:pointerleave
	on:pointerdown
	on:pointerup
	on:touchstart
	on:touchend
	on:wheel
	on:contextmenu={e => e.preventDefault()}
/>
