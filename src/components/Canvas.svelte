<script lang="ts">
    import { Mat3, Vec2 } from "ogl";
	import type { AppState, Settings } from "../lib/settings";
	import type { Board } from "../lib/board/board";
	import type { RenderParameters } from "../lib/render/canvas";
    import type { RendererOverrides } from "../lib/settings";
    import type { Template } from "../lib/render/template";
	import Render from "./Render.svelte";
    import Reticule from "./Reticule.svelte";
    import { now } from "./Cooldown.svelte";

	let canvas: Render;

	export let board: Board;
	export let settings: Settings;
	export let gamestate: AppState;
	
	$: overrides = settings.debug.render;
	let parameters = {
		// TODO: center on the center of canvas
		transform: new Mat3().identity().translate(new Vec2(-0.5, -0.5)),
		templates: [] as Template[],
		timestampStart: 0,
		timestampEnd: 0,
		heatmapDim: 0,
	} as RenderParameters;

	let innerWidth: number;
	let innerHeight: number;
	$: width = innerWidth;
	$: height = innerHeight;
	
	const info = board.info;
	$: reticuleSize = Math.min(parameters.transform[0], parameters.transform[4])
		* Math.max(window.innerWidth, window.innerHeight)
		/ Math.max(...$info.shape.size())
		/ 2;

	const palette = $info.palette;

	const [boardWidth, boardHeight] = $info.shape.size();

	$: canvasnow = Math.round($now / 1000) - $info.created_at;

	$: if (settings.heatmap.enabled) {
		if (settings.heatmap.position < 0){
			parameters.timestampEnd = canvasnow + settings.heatmap.position + 1;
			parameters.timestampStart = parameters.timestampEnd - settings.heatmap.duration;
		} else {
			parameters.timestampEnd = canvasnow + settings.heatmap.position;
			parameters.timestampStart = parameters.timestampEnd - settings.heatmap.duration;
		}
		parameters.heatmapDim = settings.heatmap.dimming;
	} else {
		parameters.timestampEnd = -1;
		parameters.timestampStart = -2;
		parameters.heatmapDim = 0;
	}

	let reticulePosition = new Vec2(0, 0);

	function positionReticule(mouseX: number, mouseY: number) {
		const x = mouseX / width;
		const y = mouseY / height;
		const viewbox = canvas.viewbox();
		const [boardX, boardY] = viewbox.into(x, y);
		
		const pixelsX = Math.floor(boardX * boardWidth);
		const pixelsY = Math.floor(boardY * boardHeight);
		const clippedX = Math.max(0, Math.min(pixelsX, boardWidth));
		const clippedY = Math.max(0, Math.min(pixelsY, boardHeight));
		
		const [x2, y2] = viewbox.outof(clippedX / boardWidth, clippedY / boardHeight);

		reticulePosition = new Vec2(x2 * width, y2 * height);
	}

	async function place(x: number, y: number) {
		if (typeof gamestate.selectedColor !== "undefined") {
			await board.place(x, y, gamestate.selectedColor, gamestate.adminOverrides);
		} else {
			throw new Error("Placed with no color selected");
		}
	}

	let dragAnchor: Vec2 | undefined;
	let clicking = false;
	let placeValid = false;

	function dragState(event: MouseEvent) {
		const position = new Vec2(event.clientX, event.clientY);
		if (!clicking && event.buttons & 1 && event.target === canvas.getElement()) {
			// start clicking
			dragAnchor = position;
			clicking = true;
			placeValid = true;
		} else if (clicking) {
			// stop clicking
			clicking = false;

			const isPlacing = typeof gamestate.selectedColor !== "undefined";

			if (placeValid && isPlacing) {
				const x = event.clientX / width;
				const y = event.clientY / height;
				const viewbox = canvas.viewbox();
				const [boardX, boardY] = viewbox.into(x, y);
				const pixelsX = Math.floor(boardX * boardWidth);
				const pixelsY = Math.floor(boardY * boardHeight);

				const xInBounds = 0 <= pixelsX && pixelsX < boardWidth;
				const yInBounds = 0 <= pixelsY && pixelsY < boardHeight;
				if (xInBounds && yInBounds) {
					place(pixelsX, pixelsY);
				} else {
					// TODO: indicate that placement is outside of canvas.
				}
			}
		}
	}

	function drag(event: MouseEvent) {
		positionReticule(event.clientX, event.clientY);

		if (clicking) {
			const dx = 2 * event.movementX / width;
			const dy = 2 * event.movementY / height;
			const scale = new Vec2(parameters.transform[0], parameters.transform[4]);
			const translate = new Vec2(dx, dy).divide(scale);
			parameters.transform = parameters.transform.translate(translate);

			// break the placement if we move too far to avoid accidental place
			const position = new Vec2(event.clientX, event.clientY);
			if (position.distance(dragAnchor) > 5) {
				placeValid = false;
			}
		}
	}

	let maxZoom = $info.shape.sectors().slice(0, 1).size().map(v => v * 2);

	async function zoom(event: WheelEvent) {
		if (event.target !== canvas.getElement()) {
			return;
		}

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

		const zoom = 1.15 ** delta;

		// the cursor position in gl space
		const position = new Vec2(event.clientX / width, event.clientY / height)
			.scale(2)
			.sub(new Vec2(1, 1))
			.applyMatrix3(new Mat3(...parameters.transform).inverse());
		
		// move the origin to the cursor, scale, then move back
		// this scales around the cursor
		parameters.transform = parameters.transform
			.translate(position)
			.scale(new Vec2(zoom, zoom));

		if (!overrides.zoom) {
			const scale = new Vec2(parameters.transform[0], parameters.transform[4]);
			const [minZoomX, minZoomY] = maxZoom;
			const correctionX = minZoomX / scale.x;
			const correctionY = minZoomY / scale.y;
			const correction = Math.max(correctionX, correctionY);
			if (correction > 1) {
				parameters.transform.scale(new Vec2(correction, correction));
			}
		}
		
		parameters.transform = parameters.transform
			.translate(position.scale(-1));

		// TODO: this is out of date so displays wrong
		positionReticule(event.clientX, event.clientY);
	}
</script>
<!--TODO: perhaps use actions to make some nice controls module -->
<svelte:window
	bind:innerWidth
	bind:innerHeight
	on:mousemove={drag}
	on:wheel={zoom}
	on:mousedown={dragState}
	on:mouseup={dragState}
/>
<Render bind:this={canvas} {board} {parameters} {overrides} {width} {height} />
<Reticule {palette} {gamestate} position={reticulePosition} size={reticuleSize} />
