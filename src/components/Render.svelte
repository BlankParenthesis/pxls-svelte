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

	export let width, height;
	export let templateStyle: HTMLImageElement;

	const viewbox = writable(ViewBox.default());
	const aspectwrite = writable(new Vec2(1, 1));

	export const view = { subscribe: viewbox.subscribe } as Readable<ViewBox>;
	export const aspect = { subscribe: aspectwrite.subscribe } as Readable<Vec2>;

	export function getElement() {
		return canvasElement;
	}

	let renderQueued = false;

	$: if (canvas) {
		canvas.setSize(width, height);
		aspectwrite.set(canvas.getAspect())
		renderQueued = true;
	}

	$: if (canvas && parameters && overrides) {
		renderQueued = true;
	}

	{
		async function render(timestamp?: number) {
			if (canvas && renderQueued) {
				try {
					viewbox.set(canvas.render(parameters, overrides));
				} catch(e) {
					console.error(e);
				}
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
		canvas.onUpdate(() => renderQueued = true);
	})
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
/>
