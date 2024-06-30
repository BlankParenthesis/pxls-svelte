<script lang="ts">
	import { Texture } from "ogl";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import type { Board } from "../lib/board/board";
	import { Canvas, type RenderParameters, type ViewBox } from "../lib/render/canvas";
	import { Template } from "../lib/render/template";
    import { type RendererOverrides } from "../lib/settings";

	let canvasElement: HTMLCanvasElement;
	let canvas: Canvas;

	export let board: Board;
	export let overrides: RendererOverrides;
	export let parameters: RenderParameters;

	export let width, height;

	export function viewbox(): ViewBox {
		return canvas?.visibleArea() || {
			left: 0,
			right: 1,
			top: 0,
			bottom: 1,
		};
	}

	let renderQueued = false;
	function render() {
		if(renderQueued) {
			return;
		}
		renderQueued = true;
		setTimeout(async () => {
			await canvas.render(parameters, overrides).catch(console.error);
			renderQueued = false;
		}, 0);
	}

	$: if (canvas) {
		canvas.setSize(width, height);
		render();
	}

	$: if (canvas && parameters && overrides) {
		render();
	}
	
	const info = board.info;

	// TODO: this is temporary
	function createTemplate(): Template {
		canvas.gl.pixelStorei(canvas.gl.UNPACK_ALIGNMENT, 1);
		const template = new Template(new Texture(canvas.gl, {
			image: new Uint8Array(new Array(200 * 200).fill(1).map((_, i) => Math.floor(i / 200) + i % 2)),
			width: 20,
			height: 20,
			format: canvas.gl.LUMINANCE,
			internalFormat: canvas.gl.LUMINANCE,
			minFilter: canvas.gl.NEAREST,
			magFilter: canvas.gl.NEAREST,
		}));
		template.x = -20;
		template.y = 4;
		canvas.gl.pixelStorei(canvas.gl.UNPACK_ALIGNMENT, 4);
		return template;
	}

	onMount(async () => {
		// TODO: pass and use the info store directly
		const i = get(info);
		canvas = new Canvas(board, i.shape, i.palette, canvasElement);
		
		parameters.templates.push(createTemplate());
		
		board.onUpdate(_ => render());
	})
</script>
<canvas bind:this="{canvasElement}" />