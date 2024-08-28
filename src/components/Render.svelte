<script lang="ts">
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import type { Board } from "../lib/board/board";
	import { Canvas, type RenderParameters, type ViewBox } from "../lib/render/canvas";
    import { type RendererOverrides } from "../lib/settings";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	export let board: Board;
	export let overrides: RendererOverrides;
	export let parameters: RenderParameters;

	export let width, height;
	export let templateStyle: HTMLImageElement;

	export function viewbox(): ViewBox {
		return canvas?.visibleArea() || {
			left: 0,
			right: 1,
			top: 0,
			bottom: 1,
		};
	}

	export function getElement() {
		return canvasElement;
	}

	let renderQueued = false;

	$: if (canvas) {
		canvas.setSize(width, height);
		renderQueued = true;
	}

	$: if (canvas && parameters && overrides) {
		renderQueued = true;
	}

	{
		async function render(timestamp?: number) {
			if (canvas && renderQueued) {
				await canvas.render(parameters, overrides).catch(console.error);
				renderQueued = false;
			}
			requestAnimationFrame(render);
		}

		render();
	}
	
	const info = board.info;

	onMount(async () => {
		// TODO: pass and use the info store directly
		const i = get(info);
		canvas = new Canvas(board, i.shape, i.palette, canvasElement, templateStyle);
		
		board.onUpdate(_ => renderQueued = true);
	})
</script>
<style>
	canvas {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: black;
	}
</style>
<canvas bind:this="{canvasElement}" />