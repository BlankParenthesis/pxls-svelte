<script lang="ts">
    import { Mat3, Vec2 } from "ogl";
	import type { AppState, LookupPointer, PlacingPointer, Pointer, Settings } from "../lib/settings";
	import type { Board } from "../lib/board/board";
	import { ViewBox, type RenderParameters } from "../lib/render/canvas";
    import type { Template } from "../lib/render/template";
	import Render from "./Render.svelte";
    import Reticule from "./Reticule.svelte";
    import { now } from "./Cooldown.svelte";
    import CanvasSpace from "./CanvasSpace.svelte";
    import { derived, readable, writable, type Readable } from "svelte/store";
    import Exact from "./layout/Exact.svelte";
    import InputCapture from "./InputCapture.svelte";
    import Ui from "./Ui.svelte";
    import type { Site } from "../lib/site";
    import templateStyleSource from "../assets/large_template_style.webp";
    import Stack from "./layout/Stack.svelte";

	let render: Render;

	export let site: Site;
	export let board: Board;

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

	$: parameters.templates = state.templates;

	let innerWidth: number;
	let innerHeight: number;
	$: width = innerWidth;
	$: height = innerHeight;

	let viewbox = readable(ViewBox.default());
	let aspect = readable(new Vec2(1, 1));
	$: if (render) {
		viewbox = render.view;
		aspect = render.aspect;
	}
	
	const info = board.info;
	let shape = $info.shape;
	$: [boardWidth, boardHeight] = shape.size();
	
	const templateStyle = new Image();
	$: templateStyle.src = settings.template.source;

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

	const RETICULE_SIZE = 60;
	/*
	let reticulePosition = new Vec2(0, 0);
	let reticuleOnBoard = false;
	$: reticuleSize = reticuleOnBoard
		? Math.min(...scale) 
			* Math.max(innerWidth, innerHeight)
			/ Math.max(...$info.shape.size())
			/ 2
		: RETICULE_SIZE;

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
			reticuleOnBoard = true;
			positionReticule(event.clientX, event.clientY);
		} else {
			reticuleOnBoard = false;
			const offset = RETICULE_SIZE / 2;
			reticulePosition = new Vec2(event.clientX - offset, event.clientY - offset);
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
	*/
	
	let settings: Settings = {
		debug: {
			render: {
				debug: false,
				debugOutline: 0.05,
				debugOutlineStripe: 0.1,
				zoom: false,
			},
		},
		heatmap: {
			enabled: false,
			duration: 3600, // one hour
			position: -1, // "now" (`-1 + 1` seconds ago)
			dimming: 0.75,
		},
		template: {
			source: templateStyleSource,
		},
		input: {
			scrollSensitivity: 1.15,
		}
	}

	let state: AppState = {
		pointer: undefined,
		adminOverrides: {
			mask: false,
			color: false,
			cooldown: false,
		},
		templates: [],
	}

	let pointerOnBoard = false;
	let pointerPosition = undefined as Vec2 | undefined;
	let reticulePosition = undefined as number | undefined;

	function setPointer(pointer: PlacingPointer | LookupPointer) {
		state.pointer = pointer;
	}

	function unsetPointer() {
		state.pointer = undefined;
	}

	function activatePointer() {
		if (typeof state.pointer !== "undefined") {
			return state.pointer.activate(reticulePosition)
				.then(() => {
					if (state.pointer?.quickActivate) {
						unsetPointer();
					}
				});
		} else {
			return new Promise(r => r(undefined));
		}
	}

	function setPointerOnBoard(state: boolean) {
		pointerOnBoard = state;
	}

	function losePointer() {
		pointerPosition = undefined;
		reticulePosition = undefined;
	}

	/**
	 * @param point - the position in range 0..=1 in board element space
	 */
	function setPointerPosition(point: Vec2) {
		pointerPosition = point;

		const [boardX, boardY] = $viewbox.into(point.x, point.y);
		if (0 > boardX || boardX > 1 || 0 > boardY || boardY > 1) {
			reticulePosition = undefined;
		} else {
			const coordinates = new Vec2(
				Math.max(0, Math.min(boardX, 1)) * boardWidth,
				Math.max(0, Math.min(boardY, 1)) * boardHeight,
			);
			const boardIndexArray = shape.coordinatesToIndexArray(coordinates.x, coordinates.y);
			const position = shape.indexArrayToPosition(boardIndexArray);
			reticulePosition = position;
		}
	}

	/**
	 * @param deltaPixels - the number of board pixels to move the reticule by
	 */
	function moveReticule(deltaPixels: Vec2) {
		if (typeof reticulePosition !== "undefined") {
			const shape = $info.shape;
			const outofArray = shape.positionToIndexArray(reticulePosition);
			const [boardX, boardY] = shape.indexArrayToCoordinates(outofArray);
			const newX = Math.max(0, Math.min(boardX + deltaPixels.x, boardWidth - 1));
			const newY = Math.max(0, Math.min(boardY + deltaPixels.y, boardHeight - 1));
			const intoArray = shape.coordinatesToIndexArray(newX, newY);
			reticulePosition = shape.indexArrayToPosition(intoArray);
		}
	}

	let grabAnchor = undefined as {
		center: Vec2,
		spacing: number,
		transform: Mat3,
	} | undefined;

	let lastGrabCenter = new Vec2(0,0);
	let grabDistance = 0;

	function canActivate() {
		return grabDistance < 10 || state.pointer?.quickActivate;
	}

	function calculateCenter(points: Array<Vec2>) {
		return points.reduce((acc, p) => acc.add(p)).divide(points.length);
	}

	function calculateSpacing(center: Vec2, points: Array<Vec2>) {
		if (points.length < 2) {
			return 1;
		} else {
			return points.reduce((acc, p) => acc + center.distance(p) / points.length, 0);
		}
	}

	function grabBoard(points: Array<Vec2>) {
		if (typeof grabAnchor !== "undefined") {
			releaseBoard();
		}

		let center = calculateCenter(points)
		const spacing = calculateSpacing(center, points);
		const transform = new Mat3(...parameters.transform);

		grabAnchor = { center, spacing, transform };
		
		lastGrabCenter = center;
		if (points.length > 1) {
			grabDistance = Infinity;
		} else {
			grabDistance = 0;
		}
	}

	let lastWidth = width;
	let lastHeight = height;
	$: if (width && height) {
		if (lastWidth !== width || lastHeight !== height) {
			const origin = new Vec2(0.5, 0.5)
				.scale(2)
				.sub(new Vec2(1, 1))
				.applyMatrix3(new Mat3(...parameters.transform).inverse());

			parameters.transform = clampView(origin, parameters.transform);
			lastWidth = width;
			lastHeight = height;
		}
	}

	function clampSmoothing(value: number, max: number): number {
		// we need a formula  f(x) that satisfies these conditions:
		// - lim x → ∞ = a
		// - f'(0) = 1
		// and, ideally:
		// - f"(x) > 0
		// f(x) = ax / (x + a) is sufficient

		return max * value / (Math.abs(value) + max);
	}

	function clampView(origin: Vec2, transform: Mat3) {
		// TODO: use viewbox

		const transformScale = new Vec2(transform[0], transform[4]);

		const scaleMax = new Vec2(boardWidth, boardHeight);
		const scaleMin = new Vec2(...shape.get(0));

		const scrollLog = Math.log(settings.input.scrollSensitivity);
		// computes the log in scroll sensitivity base of the value
		// this allows us to linearize the power scale used for scrolling
		const l = (v: number) => Math.log(v) / scrollLog;

		const overscale = new Vec2(
			Math.max(0, l(transformScale.x) - l(scaleMax.x)),
			Math.max(0, l(transformScale.y) - l(scaleMax.y)),
		);
		const underscale = new Vec2(
			Math.max(0, l(scaleMin.x) - l(transformScale.x)),
			Math.max(0, l(scaleMin.y) - l(transformScale.y)),
		);
		const baseScale = new Vec2(
			Math.max(scaleMin.x, Math.min(transformScale.x, scaleMax.x)),
			Math.max(scaleMin.y, Math.min(transformScale.y, scaleMax.y)),
		);

		const excessScale = new Vec2(
			overscale.x - underscale.x, 
			overscale.y - underscale.y, 
		);

		const scaleMargin = new Vec2(2, 2);

		const overscaleScaled = new Vec2(
			settings.input.scrollSensitivity ** clampSmoothing(excessScale.x, scaleMargin.x),
			settings.input.scrollSensitivity ** clampSmoothing(excessScale.y, scaleMargin.y),
		);

		const finalScale = baseScale.multiply(overscaleScaled);

		transform = transform
			.translate(origin)
			.scale(new Vec2(1, 1).divide(transformScale).multiply(finalScale))
			.translate(new Vec2(-1, -1).multiply(origin));

		const transformTranslate = new Vec2(transform[6], transform[7]);

		let leftEdge = -1;
		let topEdge = -1;
		let rightEdge = leftEdge + 2 - finalScale.x * $aspect.x;
		let bottomEdge = topEdge + 2 - finalScale.y * $aspect.y;

		let overleft = Math.max(0, transformTranslate.x - leftEdge);
		let overtop = Math.max(0, transformTranslate.y - topEdge);
		let overright = Math.max(0, rightEdge - transformTranslate.x) / $aspect.x;
		let overbottom = Math.max(0, bottomEdge - transformTranslate.y) / $aspect.y;

		// if the viewport is larger than the bounds, prefer to center the camera
		if (leftEdge < rightEdge) {
			leftEdge = rightEdge = finalScale.x * $aspect.x / -2;
			overleft = overright = 0;
		}

		if (topEdge < bottomEdge) {
			topEdge = bottomEdge = finalScale.y * $aspect.y / -2;
			overtop = overbottom = 0;
		}

		const baseTranslate = new Vec2(
			Math.max(rightEdge, Math.min(transformTranslate.x, leftEdge)),
			Math.max(bottomEdge, Math.min(transformTranslate.y, topEdge)),
		);

		const overTranslate = new Vec2(
			overleft - overright,
			overtop - overbottom,
		);

		const translateMargin = new Vec2(1, 1).divide(finalScale);

		const overTranslateScaled = new Vec2(
			clampSmoothing(overTranslate.x, translateMargin.x),
			clampSmoothing(overTranslate.y, translateMargin.y),
		);

		const translateInverse = new Vec2(-1, -1).divide(finalScale)
			.multiply(transformTranslate)

		transform
			.translate(translateInverse)
			.translate(baseTranslate.divide(finalScale))
			.translate(overTranslateScaled.divide(finalScale))

		return transform;
	}

	function updateGrab(points: Array<Vec2>) {
		if (typeof grabAnchor === "undefined") {
			return;
		}

		const center = calculateCenter(points);
		const spacing = calculateSpacing(center, points);

		const boardSize = new Vec2(width, height);
		const screenspaceCenter = center.clone().multiply(boardSize);
		const screenspaceLastGrabCenter = lastGrabCenter.clone().multiply(boardSize);
		grabDistance += screenspaceCenter.distance(screenspaceLastGrabCenter);

		lastGrabCenter = center.clone();

		const currentScale = new Vec2(grabAnchor.transform[0], grabAnchor.transform[4]);

		const translate = center.clone()
			.sub(grabAnchor.center)
			.multiply(2)
			.divide(currentScale);
		const scale = spacing / grabAnchor.spacing;
		
		const newTransform = new Mat3(...grabAnchor.transform).translate(translate);

		// the grab position in gl space
		const position = center
			.scale(2)
			.sub(new Vec2(1, 1))
			.applyMatrix3(new Mat3(...newTransform).inverse());

		// move the origin to the grab center, scale, then move back
		// this scales around the grab point
		newTransform
			.translate(position)
			.scale(new Vec2(scale))
			.translate(new Vec2(-1, -1).multiply(position));

		parameters.transform = clampView(position, newTransform);
	}

	/**
	 * @returns the distance traveled
	 */
	function releaseBoard() {
		grabAnchor = undefined;
	}

	/**
	 * utility function which simulates grabbing the board such that it will be
	 * scaled at the current cursor position by the provided amount.
	 */
	function scaleInstant(scale: number) {
		let center;
		if (typeof pointerPosition === "undefined") {
			center = new Vec2(0.5, 0.5);
		} else {
			center = pointerPosition;
		}

		if (typeof grabAnchor === "undefined") {
			grabBoard([
				new Vec2(center.x - 1, center.y),
				new Vec2(center.x + 1, center.y)
			]);
			updateGrab([
				new Vec2(center.x - scale, center.y),
				new Vec2(center.x + scale, center.y)
			]);
			releaseBoard();
		} else {
			grabAnchor.spacing /= scale;
			updateGrab([
				new Vec2(lastGrabCenter.x, lastGrabCenter.y),
			]);
		}
	}
</script>
<svelte:window bind:innerWidth bind:innerHeight />
<InputCapture
	ongrab={grabBoard}
	ondrag={updateGrab}
	onpoint={(p, target) => {
		setPointerOnBoard(target === render.getElement());
		setPointerPosition(p);
	}}
	oncancel={releaseBoard}
	ondrop={(p, t) => {
		if (t == render.getElement()) {
			if (canActivate()) {
				setPointerPosition(p);
				activatePointer();
			}
		}
		releaseBoard();
		losePointer();
	}}
	on:pointerleave={() => setPointerOnBoard(false)}
>
	<Render
		bind:this={render}
		{board}
		{parameters}
		{overrides}
		{width}
		{height}
		{templateStyle}
		on:pointerenter={() => setPointerOnBoard(true)}
		on:pointerleave={() => setPointerOnBoard(false)}
		on:pointerdown={e => {
			if (e.pointerType !== "touch") {
				grabBoard([new Vec2(e.offsetX / width, e.offsetY / height)]);
			}
		}}
		on:pointerup={e => {
			if (e.pointerType !== "touch") {
				if (canActivate()) {
					activatePointer();
				}
			}
		}}
		on:touchstart={e => {
			const rect = render.getElement().getBoundingClientRect();
			grabBoard(Array.from(e.touches).map(t => new Vec2(
				(t.pageX - rect.x) / rect.width,
				(t.pageY - rect.y) / rect.height,
			)))
		}}
		on:touchend={e => {
			if (e.touches.length === 0) {
				if (canActivate()) {
					const rect = render.getElement().getBoundingClientRect();
					setPointerPosition(new Vec2(
						(e.changedTouches[0].pageX - rect.x) / rect.width,
						(e.changedTouches[0].pageY - rect.y) / rect.height,
					));
					activatePointer();
					// InputCapture should do this anyway, but this is also
					// correct here and the function is idempotent.
					losePointer();
				}
			}
		}}
		on:wheel={e => {
			let delta = -e.deltaY;

			switch (e.deltaMode) {
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

			const zoom = settings.input.scrollSensitivity ** delta;
			scaleInstant(zoom);
		}}
	/>
	{#if typeof state.pointer !== "undefined"}
		{#if pointerOnBoard && typeof reticulePosition !== "undefined"}
			<CanvasSpace
				shape={$info.shape}
				viewbox={$viewbox}
				boardSize={new Vec2(width, height)}
				position={reticulePosition}
			>
				<Reticule pointer={state.pointer} />
			</CanvasSpace>
		{/if}
	{/if}
	<Ui {site} {board} bind:state bind:settings />
	{#if typeof state.pointer !== "undefined"}
		{#if (!pointerOnBoard || typeof reticulePosition === "undefined")  && typeof pointerPosition !== "undefined"}
			<Exact
				x={pointerPosition.x * width - RETICULE_SIZE / 2}
				y={pointerPosition.y * height - RETICULE_SIZE / 2}
				width={RETICULE_SIZE}
				height={RETICULE_SIZE}
			>
				<Reticule pointer={state.pointer} />
			</Exact>
		{/if}
	{/if}
</InputCapture>