<script lang="ts">
    import { Mat3, Vec2 } from "ogl";
	import type { AppState, LookupPointer, PlacingPointer, Settings } from "../lib/settings";
	import type { Board } from "../lib/board/board";
	import { ViewBox, type RenderParameters } from "../lib/render/canvas";
    import type { Template } from "../lib/render/template";
	import Render from "./Render.svelte";
    import Reticule from "./Reticule.svelte";
    import { now } from "./Cooldown.svelte";
    import CanvasSpace from "./CanvasSpace.svelte";
    import { readable }  from "svelte/store";
    import Exact from "./layout/Exact.svelte";
    import InputCapture from "./InputCapture.svelte";
    import Ui from "./Ui.svelte";
    import type { Site } from "../lib/site";
    import templateStyleSource from "../assets/large_template_style.webp";
    import { onMount } from "svelte";
    import { linearRegression } from "../lib/util";

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

	$: parameters.templates = state.templates;

	let innerWidth: number;
	let innerHeight: number;
	$: width = innerWidth;
	$: height = innerHeight;

	let viewbox = ViewBox.default();
	let aspect = readable(new Vec2(1, 1));
	$: if (render) {
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
			dragVelocityAccumulation: 200,
			dragVelocitySensitivity: 0.98,
			dragVelocityDrag: 0.95,
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

		const [boardX, boardY] = viewbox.into(point.x, point.y);
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
		renderQueued = true;
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
		renderQueued = true;
	}

	let grabAnchor = undefined as {
		center: Vec2,
		spacing: number,
		transform: Mat3,
	} | undefined;

	let lastGrabCenter = new Vec2(0,0);
	let grabDistance = 0;
	let grabVectors = [] as Array<{ point: Vec2, time: number }>;
	let velocity = new Vec2(0, 0);

	function canActivate() {
		return grabDistance < 10 || state.pointer?.quickActivate;
	}

	function calculateCenter(points: Array<Vec2>) {
		return points.reduce((acc, p) => acc.add(p), new Vec2())
				.divide(points.length);
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
		let spacing = calculateSpacing(center, points);

		const transform = new Mat3(...parameters.transform);
		const transformTranslate = new Vec2(transform[6], transform[7]);
		const transformScale = new Vec2(transform[0], transform[4]);
		const scale = scaleOverflow(transformScale);
		const translate = translateOverflow(transformTranslate, transformScale);
		
		if (translate.overflow.x < 0) {
			translate.overflow.x *= $aspect.x;
		}
		
		if (translate.overflow.y < 0) {
			translate.overflow.y *= $aspect.y;
		}
		
		const translateMargin = new Vec2(1, 1).divide(transformScale)
		
		const overtranslateCompensation = new Vec2(
			clampSmoothingInv(translate.overflow.x, translateMargin.x) / 2,
			clampSmoothingInv(translate.overflow.y, translateMargin.y) / 2,
		);
		
		const overscaleCompensation = new Vec2(
			clampSmoothingInv(scale.overflow.x, 2),
			clampSmoothingInv(scale.overflow.y, 2),
		);
		
		// put camera back in bounds first
		center.add(translate.overflow.clone().divide(2))
		spacing *= settings.input.scrollSensitivity ** scale.overflow.x;
		
		// then apply the required offset to keep it in the same place
		center.sub(overtranslateCompensation);
		spacing /= settings.input.scrollSensitivity ** overscaleCompensation.x;

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

	/**
	 * Returns a number that approaches max as value tends to infinity. This can
	 * be used to smoothly approach a hard limit rather than suddenly stopping.
	 */
	function clampSmoothing(value: number, max: number): number {
		// we need a formula f(x) that satisfies these conditions:
		// - lim x → ∞ = a (= max)
		// - f'(0) = 1
		// and, ideally:
		// - f"(x) > 0
		// f(x) = ax / (x + a) is sufficient

		return max * value / (Math.abs(value) + max);
	}

	/**
	 * Computes the inverse of clampSmoothing given max.
	 */
	function clampSmoothingInv(smoothed: number, max: number): number {
		// we have f(x) and a (max), we want x:
		// f(x) = ax / (x + a)
		// f(x) * (x + a) = ax
		// f(x)x + f(x)a = ax
		// f(x)a = ax - f(x)x
		// x = (f(x)a)/(a - f(x))

		return max * smoothed / (max - Math.abs(smoothed));
	}
	
	function scaleOverflow(scale: Vec2) {
		const scaleMax = new Vec2(boardWidth, boardHeight);
		const scaleMin = new Vec2(...shape.get(0));
	
		const scrollLog = Math.log(settings.input.scrollSensitivity);
		// computes the log in scroll sensitivity base of the value
		// this allows us to linearize the power scale used for scrolling
		const l = (v: number) => Math.log(v) / scrollLog;
	
		const overscale = new Vec2(
			Math.max(0, l(scale.x) - l(scaleMax.x)),
			Math.max(0, l(scale.y) - l(scaleMax.y)),
		);
		const underscale = new Vec2(
			Math.max(0, l(scaleMin.x) - l(scale.x)),
			Math.max(0, l(scaleMin.y) - l(scale.y)),
		);
		const base = new Vec2(
			Math.max(scaleMin.x, Math.min(scale.x, scaleMax.x)),
			Math.max(scaleMin.y, Math.min(scale.y, scaleMax.y)),
		);
	
		const overflow = new Vec2(
			overscale.x - underscale.x, 
			overscale.y - underscale.y, 
		);
		
		return { base, overflow };
	}
	
	function translateOverflow(translate: Vec2, scale: Vec2) {
		let leftEdge = -1;
		let topEdge = -1;
		let rightEdge = leftEdge + 2 - scale.x * $aspect.x;
		let bottomEdge = topEdge + 2 - scale.y * $aspect.y;

		let overleft = Math.max(0, translate.x - leftEdge);
		let overtop = Math.max(0, translate.y - topEdge);
		let overright = Math.max(0, rightEdge - translate.x) / $aspect.x;
		let overbottom = Math.max(0, bottomEdge - translate.y) / $aspect.y;

		// if the viewport is larger than the bounds, prefer to center the camera
		if (leftEdge < rightEdge) {
			leftEdge = rightEdge = scale.x * $aspect.x / -2;
			overleft = overright = 0;
		}

		if (topEdge < bottomEdge) {
			topEdge = bottomEdge = scale.y * $aspect.y / -2;
			overtop = overbottom = 0;
		}

		const base = new Vec2(
			Math.max(rightEdge, Math.min(translate.x, leftEdge)),
			Math.max(bottomEdge, Math.min(translate.y, topEdge)),
		);

		const overflow = new Vec2(
			overleft - overright,
			overtop - overbottom,
		);
		
		return { base, overflow };
	}

	function clampView(origin: Vec2, transform: Mat3) {
		// TODO: use viewbox
		const transformScale = new Vec2(transform[0], transform[4]);
		const scale = scaleOverflow(transformScale);
		const baseScale = scale.base;
		const overScale = scale.overflow;

		const scaleMargin = new Vec2(2, 2);
		
		const overscaleScaled = new Vec2(
			settings.input.scrollSensitivity ** clampSmoothing(overScale.x, scaleMargin.x),
			settings.input.scrollSensitivity ** clampSmoothing(overScale.y, scaleMargin.y),
		);

		let finalScale;
		if (overScale.x < overScale.y) {
			const scale = baseScale.x * overscaleScaled.x;
			finalScale = new Vec2(scale, scale);
		} else {
			const scale = baseScale.y * overscaleScaled.y;
			finalScale = new Vec2(scale, scale);
		}

		transform = transform
			.translate(origin)
			.scale(new Vec2(1, 1).divide(transformScale).multiply(finalScale))
			.translate(new Vec2(-1, -1).multiply(origin));

		const transformTranslate = new Vec2(transform[6], transform[7]);
		const translate = translateOverflow(transformTranslate, finalScale);
		const baseTranslate = translate.base;
		const overTranslate = translate.overflow;

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
	
	function trimGrabVectors(now: number) {
		const vectorThreshold = now - settings.input.dragVelocityAccumulation;
		const firstValidVector = grabVectors.findIndex(v => v.time > vectorThreshold);
		if (firstValidVector === -1) {
			grabVectors = [];
		} else {
			grabVectors.splice(0, firstValidVector);
		}
	}

	function updateGrab(points: Array<Vec2>) {
		if (typeof grabAnchor === "undefined") {
			return;
		}

		const center = calculateCenter(points);
		const spacing = calculateSpacing(center, points);
		
		const now = Date.now();
		trimGrabVectors(now);
		grabVectors.push({ point: center.clone(), time: now });

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
		renderQueued = true;
	}
	
	/**
	 * This attempts to compute what the user currently expects the board's 
	 * velocity is using recent pointer data.
	 * @returns the apparent velocity the board is being moved with
	 */
	function calculateFling(): Vec2 {		
		const first = grabVectors.shift();
		const last = grabVectors[grabVectors.length - 1];
		if (typeof first !== "undefined" && typeof last !== "undefined") {
			const distanceByTime = grabVectors.map(v => {
				const distance = v.point.distance(first.point);
				const time = v.time - first.time;
				return [time, distance] as [number, number];
			});
			
			// Fit a line to the distance / time data.
			// A fling drag is close to a straight line (distance increases linearly with time)
			// A drag + stop has a non-linear shape and therefor a lower correlation.
			const { slope, intercept, correlation } = linearRegression(distanceByTime);
			
			if (correlation > settings.input.dragVelocitySensitivity) {
				const transformScale = new Vec2(parameters.transform[0], parameters.transform[4]);
				const difference = last.point.sub(first.point)
						.normalize()
						.multiply(slope) // slope is distance / time = velocity
						.divide(transformScale);
				return difference;
			}
		}

		// Assume no velocity by default
		return new Vec2(0, 0);
	}

	/**
	 * @returns the distance traveled
	 */
	function releaseBoard() {
		const now = Date.now();
		const last = grabVectors[grabVectors.length - 1];
		if (typeof last !== "undefined") {
			// add now to the vectors since we may have held the pointer still
			// for a bit, which should could as a grab point.
			grabVectors.push({ point: last.point, time: now })
		}
		trimGrabVectors(now);
		velocity = calculateFling();
		
		grabVectors = [];
		grabAnchor = undefined;
		renderQueued = true;
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
	
	function doPhysics(delta: number) {
		// move into deltatime
		velocity.multiply(delta);
		// apply drag
		velocity.multiply(settings.input.dragVelocityDrag);
		parameters.transform.translate(velocity);
		// undo deltatime move
		velocity.divide(delta);
	}
	
	let renderQueued = false;
	let lastRender: number;
	function paint(time?: number) {
		if (typeof time !== "undefined") {
			if (typeof lastRender !== "undefined") {
				const delta = time - lastRender;
				if (typeof grabAnchor === "undefined") {
					doPhysics(delta);
				}
			}
			lastRender = time;
		}
		
		if (render && renderQueued) {
			viewbox = render.paint();
		}
		requestAnimationFrame(paint);
	}
	
	onMount(paint);
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
				viewbox={viewbox}
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
