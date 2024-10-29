<script lang="ts">
    import { Mat3, Vec2 } from "ogl";
	import type { AppState, Settings } from "../lib/settings";
	import type { Board } from "../lib/board/board";
	import { ViewBox, type RenderParameters } from "../lib/render/canvas";
    import type { Template } from "../lib/render/template";
	import Render from "./Render.svelte";
    import Reticule from "./Reticule.svelte";
    import { now } from "./Cooldown.svelte";
    import CanvasSpace from "./CanvasSpace.svelte";
    import { derived, readable, writable, type Readable } from "svelte/store";
    import Exact from "./layout/Exact.svelte";

	let render: Render;

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

	$: translate = [parameters.transform[1], parameters.transform[2]];
	$: scale = [parameters.transform[0], parameters.transform[4]];

	$: parameters.templates = gamestate.templates;

	let innerWidth: number;
	let innerHeight: number;
	$: width = innerWidth;
	$: height = innerHeight;

	let viewbox = readable(ViewBox.default());
	$: if (render) {
		viewbox = render.view;
	}
	
	const info = board.info;
	$: pixelSize = Math.min(parameters.transform[0], parameters.transform[4])
		* Math.max(window.innerWidth, window.innerHeight)
		/ Math.max(...$info.shape.size())
		/ 2;

	const templateStyle = new Image();
	$: templateStyle.src = settings.template.source;

	const [boardWidth, boardHeight] = $info.shape.size();

	$: canvasnow = (Math.round($now) - $info.createdAt.valueOf()) / 1000;

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
	let reticuleSize = new Vec2(0, 0);

	function positionReticule(mouseX: number, mouseY: number) {
		const x = mouseX / width;
		const y = mouseY / height;
		const [boardX, boardY] = $viewbox.into(x, y);
		
		const pixelsX = Math.floor(boardX * boardWidth);
		const pixelsY = Math.floor(boardY * boardHeight);
		const clippedX = Math.max(0, Math.min(pixelsX, boardWidth - 1));
		const clippedY = Math.max(0, Math.min(pixelsY, boardHeight - 1));

		const [x2, y2] = $viewbox.outof(clippedX / boardWidth, clippedY / boardHeight);
		reticulePosition = new Vec2(x2 * width, y2 * height);
		reticuleSize = new Vec2(scale[0] * 2, scale[1] * 2);
	}

	let dragAnchor: Vec2 | undefined;
	let clicking = false;
	let placeValid = false;

	function dragState(event: MouseEvent) {
		const position = new Vec2(event.clientX, event.clientY);
		const pressing = event.buttons & 1;
		const onCanvas = event.target === render.getElement();
		const usingTool = typeof gamestate.pointer !== "undefined";
		const quickPlacing = gamestate.pointer?.type === "quick-place";

		if (quickPlacing && !pressing) {
			if (onCanvas) {
				tryPlace(position);
			}
			gamestate.pointer = undefined;
		}

		if (!clicking && event.buttons & 1 && pressing && onCanvas) {
			// start clicking
			dragAnchor = position;
			clicking = true;
			placeValid = true;
		} else if (clicking) {
			// stop clicking
			clicking = false;

			if (usingTool && placeValid) {
				tryPlace(position);
			}
		}
	}

	async function tryPlace(clickPosition: Vec2) {
		const x = clickPosition.x / width;
		const y = clickPosition.y / height;
		const [boardX, boardY] = $viewbox.into(x, y);
		const pixelsX = Math.floor(boardX * boardWidth);
		const pixelsY = Math.floor(boardY * boardHeight);

		const xInBounds = 0 <= pixelsX && pixelsX < boardWidth;
		const yInBounds = 0 <= pixelsY && pixelsY < boardHeight;
		if (xInBounds && yInBounds) {
			if (typeof gamestate.pointer !== "undefined") {
				// TODO: feedback for waiting and error
				await gamestate.pointer.activate(pixelsX, pixelsY);
			} else {
				throw new Error("Placed with no color selected");
			}
		} else {
			// TODO: indicate that placement is outside of canvas.
		}
	}

	function drag(event: MouseEvent) {
		if (event.target === render.getElement()) {
			positionReticule(event.clientX, event.clientY);
		} else {
			const SIZE = 60;
			reticuleSize = new Vec2(SIZE, SIZE);
			reticulePosition = new Vec2(event.clientX - SIZE / 2, event.clientY - SIZE / 2);
		}

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
		if (event.target !== render.getElement()) {
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

		// TODO: this is out of date since the canvas is about to render and change the viewbox
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
<Render bind:this={render} {board} {parameters} {overrides} {width} {height} {templateStyle}/>
{#if typeof gamestate.pointer !== "undefined"}
	<Exact
		x={reticulePosition.x}
		y={reticulePosition.y}
		width={reticuleSize.x}
		height={reticuleSize.y}>
		<Reticule pointer={gamestate.pointer} />
	</Exact>
{/if}