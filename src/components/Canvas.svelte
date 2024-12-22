<script lang="ts">
	import { Mat3, Vec2 } from "ogl";
	import type { AppState, Settings } from "../lib/settings";
	import type { Activation, LookupPointer, PlacingPointer } from "../lib/pointer";
	import type { Board } from "../lib/board/board";
	import { ViewBox, type RenderParameters } from "../lib/render/canvas";
	import type { Template } from "../lib/render/template";
	import Render from "./Render.svelte";
	import Reticule from "./Reticule.svelte";
	import { now } from "./Time.svelte";
	import CanvasSpace from "./CanvasSpace.svelte";
	import { readable } from "svelte/store";
	import Exact from "./layout/Exact.svelte";
	import InputCapture from "./InputCapture.svelte";
	import Placement from "./Placement.svelte";
	import Lookup from "./Lookup.svelte";
	import Ui from "./Ui.svelte";
	import type { Site } from "../lib/site";
	import templateStyleSource from "../assets/large_template_style.webp";
	import { onMount } from "svelte";
	import { linearRegression } from "../lib/util";

	let render: Render;

	export let site: Site;
	export let board: Board;

	const info = board.info;
	let shape = $info.shape;

	const margin = {
		scale: new Vec2(2, 2),
		translate: new Vec2(1, 1),
	};

	let padding: { scale: Vec2; translate: Vec2 };
	if (shape.get(0).every(d => d === 1)) {
		// allow canvases which hint at being able to view the entire board at
		// once some more liberal scale values
		padding = {
			scale: new Vec2(0, 0),
			translate: new Vec2(0.5, 0.5),
		};
	} else {
		padding = {
			scale: new Vec2(-2, -2),
			translate: new Vec2(0.5, 0.5),
		};
	}

	$: overrides = settings.debug.render;
	let parameters = {
		transform: new Mat3().identity(),
		templates: [] as Template[],
		timestampStart: 0,
		timestampEnd: 0,
		heatmapDim: 0,
	} as RenderParameters;

	$: parameters.templates = state.templates;

	let boardSize = new Vec2(1, 1);

	let viewbox = ViewBox.default();
	let aspect = readable(new Vec2(1, 1));
	let lastAspect: Vec2;
	$: if (render) {
		aspect = render.aspect;

		aspect.subscribe((value) => {
			if (typeof lastAspect !== "undefined") {
				// shift transform to be relative to new aspect so camera center
				// stays the same
				parameters.transform[6] *= value.x / lastAspect.x;
				parameters.transform[7] *= value.y / lastAspect.y;
			}
			lastAspect = value;
		});
	}

	// center camera
	parameters.transform = new Mat3().identity()
		.scale(scaleBounds().min)
		.translate($aspect.clone().divide(-2));

	$: [boardWidth, boardHeight] = shape.size();

	const templateStyle = new Image();
	$: templateStyle.src = settings.template.source;

	$: canvasnow = (Math.round($now) - $info.createdAt.valueOf()) / 1000;

	$: if (settings.heatmap.enabled) {
		if (settings.heatmap.position < 0) {
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
			dragVelocitySensitivity: 0.96,
			dragVelocityFriction: 1 - 1 / 250,
			bounceStrength: 1 / 5000,
		},
	};

	let state: AppState = {
		pointer: undefined,
		adminOverrides: {
			mask: false,
			color: false,
			cooldown: false,
		},
		templates: [],
	};

	let pointerOnBoard = false;
	let pointerPosition = undefined as Vec2 | undefined;
	let reticulePosition = undefined as number | undefined;

	function setPointer(pointer: PlacingPointer | LookupPointer) {
		state.pointer = pointer;
	}

	function unsetPointer() {
		state.pointer = undefined;
	}

	let activationIndex = 0;
	let activations = new Map<number, Activation>();

	async function activatePointer() {
		if (typeof state.pointer !== "undefined") {
			const index = activationIndex++;
			const activation = state.pointer.activate(reticulePosition);
			if (state.pointer?.quickActivate) {
				unsetPointer();
			}
			activations.set(index, activation);
			activations = activations;
			activation.task
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.then(data => activation.finalizer.finalize(data as any))
				.catch(_ => activation.finalizer.error())
				.finally(() => {
					activations.delete(index);
					activations = activations;
				});
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
		center: Vec2;
		spacing: number;
		transform: Mat3;
	} | undefined;

	let lastGrabCenter = new Vec2(0, 0);
	let grabDistance = 0;
	let grabVectors = [] as Array<{ point: Vec2; time: number }>;
	let velocity = new Vec2(0, 0);
	let scaleVelocity = new Vec2(0, 0);

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

		let center = calculateCenter(points);
		let spacing = calculateSpacing(center, points);

		const transform = new Mat3(...parameters.transform);
		const transformTranslate = new Vec2(transform[6], transform[7]);
		const transformScale = new Vec2(transform[0], transform[4]);
		const scale = scaleOverflow(transformScale);
		const translate = translateOverflow(transformTranslate, transformScale);

		const overtranslateCompensation = new Vec2(
			clampSmoothingInv(translate.overflow.x, margin.translate.x),
			clampSmoothingInv(translate.overflow.y, margin.translate.y),
		);

		const overscaleCompensation = new Vec2(
			clampSmoothingInv(scale.overflow.x, margin.scale.x),
			clampSmoothingInv(scale.overflow.y, margin.scale.y),
		);

		// put camera back in bounds first
		center.add(translate.overflow.clone().divide(2));
		spacing *= settings.input.scrollSensitivity ** scale.overflow.x;

		// then apply the required offset to keep it in the same place
		center.sub(overtranslateCompensation.divide(2));
		spacing /= settings.input.scrollSensitivity ** overscaleCompensation.x;

		grabAnchor = { center, spacing, transform };

		lastGrabCenter = center;
		if (points.length > 1) {
			grabDistance = Infinity;
		} else {
			grabDistance = 0;
		}
	}

	let lastSize = boardSize;
	$: if (boardSize) {
		if (!boardSize.equals(lastSize)) {
			const origin = new Vec2(0.5, 0.5)
				.scale(2)
				.sub(new Vec2(1, 1))
				.applyMatrix3(new Mat3(...parameters.transform).inverse());

			parameters.transform = clampView(origin, parameters.transform);
			lastSize = boardSize;
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

		if (smoothed === max) {
			// technically this should be Infinity, but this is large enough
			// and also doesn't mess with stuff too much.
			return 1e9 * Math.sign(smoothed);
		} else {
			return max * smoothed / (max - Math.abs(smoothed));
		}
	}

	const SCALE_BASE = 1.5;

	function scaleBounds() {
		const scaledPadding = new Vec2(SCALE_BASE ** padding.scale.x, SCALE_BASE ** padding.scale.y);
		return {
			min: new Vec2(...shape.get(0)).divide(scaledPadding),
			max: new Vec2(boardWidth, boardHeight),
		};
	}

	function scaleOverflow(scale: Vec2) {
		const logbase = Math.log(SCALE_BASE);
		const bounds = scaleBounds();
		// computes log in the base so that each increase by 1 in overflow is a
		// equal in apparent size
		const l = (v: number) => Math.log(v) / logbase;

		const overscale = new Vec2(
			Math.max(0, l(scale.x) - l(bounds.max.x)),
			Math.max(0, l(scale.y) - l(bounds.max.y)),
		);
		const underscale = new Vec2(
			Math.max(0, l(bounds.min.x) - l(scale.x)),
			Math.max(0, l(bounds.min.y) - l(scale.y)),
		);
		const base = new Vec2(
			Math.max(bounds.min.x, Math.min(scale.x, bounds.max.x)),
			Math.max(bounds.min.y, Math.min(scale.y, bounds.max.y)),
		);

		const overflow = new Vec2(
			overscale.x - underscale.x,
			overscale.y - underscale.y,
		);

		return { base, overflow };
	}

	function translateBounds(scale: Vec2) {
		let leftEdge = -1;
		let topEdge = -1;
		let rightEdge = leftEdge + 2 - scale.x * $aspect.x;
		let bottomEdge = topEdge + 2 - scale.y * $aspect.y;
		return {
			upper: new Vec2(leftEdge, topEdge).add(padding.translate),
			lower: new Vec2(rightEdge, bottomEdge).sub(padding.translate),
		};
	}

	function translateOverflow(translate: Vec2, scale: Vec2) {
		const { upper, lower } = translateBounds(scale);

		let overleft = Math.max(0, translate.x - upper.x);
		let overtop = Math.max(0, translate.y - upper.y);
		let overright = Math.max(0, lower.x - translate.x);
		let overbottom = Math.max(0, lower.y - translate.y);

		// if the viewport is larger than the bounds, prefer to center the camera
		if (upper.x < lower.x) {
			const center = (lower.x + upper.x) / 2;
			lower.x = upper.x = center;
			overleft /= 2;
			overright /= 2;
		}

		if (upper.y < lower.y) {
			const center = (lower.y + upper.y) / 2;
			lower.y = upper.y = center;
			overtop /= 2;
			overbottom /= 2;
		}

		const base = new Vec2(
			Math.max(lower.x, Math.min(translate.x, upper.x)),
			Math.max(lower.y, Math.min(translate.y, upper.y)),
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

		const overscaleScaled = new Vec2(
			settings.input.scrollSensitivity ** clampSmoothing(overScale.x, margin.scale.x),
			settings.input.scrollSensitivity ** clampSmoothing(overScale.y, margin.scale.y),
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

		const overTranslateScaled = new Vec2(
			clampSmoothing(overTranslate.x, margin.translate.x),
			clampSmoothing(overTranslate.y, margin.translate.y),
		);

		const translateInverse = new Vec2(-1, -1).divide(finalScale)
			.multiply(transformTranslate);

		transform
			.translate(translateInverse)
			.translate(baseTranslate.divide(finalScale))
			.translate(overTranslateScaled.divide(finalScale));

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
			const distanceByTime = grabVectors.map((v) => {
				const distance = v.point.distance(first.point);
				const time = v.time - first.time;
				return [time, distance] as [number, number];
			});

			// Fit a line to the distance / time data.
			// A fling drag is close to a straight line (distance increases linearly with time)
			// A drag + stop has a non-linear shape and therefor a lower correlation.
			const { slope, correlation } = linearRegression(distanceByTime);

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
			grabVectors.push({ point: last.point, time: now });
		}
		trimGrabVectors(now);
		velocity = calculateFling();

		grabVectors = [];
		grabAnchor = undefined;
		renderQueued = true;
	}

	let siTimeout: number | undefined;
	// Waits just a little bit in case we are scrolling with a touch
	// device and the rate would make the physics freak out if we
	// released immediately.
	function scaleInstantDeferredRealease() {
		clearTimeout(siTimeout);
		siTimeout = setTimeout(() => {
			releaseBoard();
			siTimeout = undefined;
		}, 50);
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
				new Vec2(center.x + 1, center.y),
			]);
			updateGrab([
				new Vec2(center.x - scale, center.y),
				new Vec2(center.x + scale, center.y),
			]);
			scaleInstantDeferredRealease();
		} else {
			grabAnchor.spacing /= scale;
			updateGrab([
				new Vec2(lastGrabCenter.x, lastGrabCenter.y),
			]);
			if (typeof siTimeout !== "undefined") {
				scaleInstantDeferredRealease();
			}
		}
	}

	function hardClamp() {
		let transform = new Mat3(...parameters.transform);
		let transformScale = new Vec2(transform[0], transform[4]);

		const bounds = translateBounds(transformScale);

		const xMin = bounds.lower.x - margin.translate.x + 0.1;
		const xMax = bounds.upper.x + margin.translate.x - 0.1;
		const yMin = bounds.lower.y - margin.translate.y + 0.1;
		const yMax = bounds.upper.y + margin.translate.y - 0.1;

		const newX = Math.max(xMin, Math.min(transform[6], xMax));
		const newY = Math.max(yMin, Math.min(transform[7], yMax));

		if (parameters.transform[6] !== newX || parameters.transform[7] !== newY) {
			parameters.transform[6] = newX;
			parameters.transform[7] = newY;
		}
	}

	function doPhysics(delta: number) {
		if (delta === 0) {
			// NOTE: it may seem strange that we get a zero delta, but this
			// does happen not infrequently. I imagine this is because a reflow
			// is triggered during an animation frame ans schedules a new one
			// immedialty.
			// One easy way to trigger this is seemingly something like toggling
			// one of the panel buttons.
			return;
		}

		let transform = new Mat3(...parameters.transform);
		let transformTranslate = new Vec2(transform[6], transform[7]);
		let transformScale = new Vec2(transform[0], transform[4]);

		const scale = scaleOverflow(transformScale);
		const translate = translateOverflow(transformTranslate, transformScale);

		const overtranslateCompensation = new Vec2(
			clampSmoothing(translate.overflow.x, margin.translate.x),
			clampSmoothing(translate.overflow.y, margin.translate.y),
		);

		const bounceForce = new Vec2(0, 0);

		const friction = new Vec2(1, 1).multiply(settings.input.dragVelocityFriction);

		const overXEdge = Math.abs(overtranslateCompensation.x) > 1e-3;
		const overYEdge = Math.abs(overtranslateCompensation.y) > 1e-3;
		const movingX = Math.abs(velocity.x) > 1e-6;
		const movingY = Math.abs(velocity.y) > 1e-6;

		const edgeFrictionRatio = settings.input.bounceStrength * 50;
		if (overXEdge) {
			const scaledCompensationX = overtranslateCompensation.x / margin.translate.x;
			friction.x *= Math.abs(scaledCompensationX) ** edgeFrictionRatio;
			bounceForce.x = overtranslateCompensation.x / transformScale.x * settings.input.bounceStrength;
		} else if (!movingX) {
			velocity.x = 0;
		}

		if (overYEdge) {
			const scaledCompensationY = overtranslateCompensation.y / margin.translate.y;
			friction.y *= Math.abs(scaledCompensationY) ** edgeFrictionRatio;
			bounceForce.y = overtranslateCompensation.y / transformScale.y * settings.input.bounceStrength;
		} else if (!movingY) {
			velocity.y = 0;
		}

		// apply translate velocity
		velocity.sub(bounceForce.multiply(delta));
		// apply drag
		velocity.multiply(new Vec2(friction.x ** delta, friction.y ** delta));

		const overscaleCompensation = new Vec2(
			clampSmoothing(scale.overflow.x, margin.scale.x),
			clampSmoothing(scale.overflow.y, margin.scale.y),
		);

		const overScaleX = Math.abs(overscaleCompensation.x) > 1e-3;
		const overScaleY = Math.abs(overtranslateCompensation.y) > 1e-3;

		const compensator = Math.min(overscaleCompensation.x, overscaleCompensation.y);
		scaleVelocity = new Vec2(-compensator, -compensator);

		if (overXEdge || overYEdge || movingX || movingY || overScaleX || overScaleY) {
			renderQueued = true;
		}

		// move into deltatime
		velocity.multiply(delta);
		scaleVelocity.multiply(delta);

		const scaleTranslateBounceRatio = 20;
		const scaleVelocityMult = new Vec2(
			(1 + settings.input.bounceStrength * scaleTranslateBounceRatio) ** scaleVelocity.x,
			(1 + settings.input.bounceStrength * scaleTranslateBounceRatio) ** scaleVelocity.y,
		);

		const origin = new Vec2(0.5, 0.5)
			.scale(2)
			.sub(new Vec2(1, 1))
			.applyMatrix3(new Mat3(...parameters.transform).inverse());

		// apply velocities
		parameters.transform
			.translate(origin)
			.scale(scaleVelocityMult)
			.translate(new Vec2(-1, -1).multiply(origin))
			.translate(velocity);

		// undo deltatime move
		velocity.divide(delta);
		scaleVelocity.divide(delta);

		hardClamp();
	}

	$: if (parameters && overrides) {
		renderQueued = true;
	}

	let renderQueued = false;
	let lastRender: number;
	function paint(time?: number) {
		if (render && renderQueued) {
			renderQueued = false;

			if (typeof time !== "undefined") {
				if (typeof lastRender !== "undefined") {
					const delta = time - lastRender;
					if (typeof grabAnchor === "undefined") {
						doPhysics(delta);
					}
				}
				lastRender = time;
			}
			viewbox = render.paint();
		}
		requestAnimationFrame(paint);
	}

	onMount(paint);
</script>
<InputCapture
	onbounds={(bounds) => {
		boardSize = new Vec2(bounds.width, bounds.height);
	}}
	ongrab={grabBoard}
	ondrag={updateGrab}
	onpoint={(p, target) => {
		setPointerOnBoard(target === render.getElement());
		setPointerPosition(p);
	}}
	oncancel={releaseBoard}
	ondrop={(p, t) => {
		if (t === render.getElement()) {
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
		size={boardSize}
		{templateStyle}
		on:pointerenter={() => setPointerOnBoard(true)}
		on:pointerleave={() => setPointerOnBoard(false)}
		on:pointerdown={(event) => {
			if (event.pointerType !== "touch") {
				grabBoard([new Vec2(event.offsetX, event.offsetY).divide(boardSize)]);
			}
		}}
		on:pointerup={(event) => {
			if (event.pointerType !== "touch") {
				if (canActivate()) {
					activatePointer();
				}
			}
		}}
		on:touchstart={(event) => {
			const rect = render.getElement().getBoundingClientRect();
			grabBoard(Array.from(event.touches).map(t => new Vec2(
				(t.pageX - rect.x) / rect.width,
				(t.pageY - rect.y) / rect.height,
			)));
		}}
		on:touchend={(event) => {
			if (event.touches.length === 0) {
				if (canActivate()) {
					const rect = render.getElement().getBoundingClientRect();
					setPointerPosition(new Vec2(
						(event.changedTouches[0].pageX - rect.x) / rect.width,
						(event.changedTouches[0].pageY - rect.y) / rect.height,
					));
					activatePointer();
					// InputCapture should do this anyway, but this is also
					// correct here and the function is idempotent.
					losePointer();
				}
			}
		}}
		on:wheel={(event) => {
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

			const zoom = settings.input.scrollSensitivity ** delta;
			scaleInstant(zoom);
			event.preventDefault();
		}}
	/>
	{#if typeof state.pointer !== "undefined"}
		{#if pointerOnBoard && typeof reticulePosition !== "undefined"}
			<CanvasSpace
				shape={$info.shape}
				viewbox={viewbox}
				{boardSize}
				position={reticulePosition}
			>
				<Reticule pointer={state.pointer} />
			</CanvasSpace>
		{/if}
	{/if}
	{#each activations as [index, activation] (index)}
		{#if typeof activation.position !== "undefined"}
			<CanvasSpace
				shape={$info.shape}
				viewbox={viewbox}
				{boardSize}
				position={activation.position}
			>
				{#if activation.type === "place"}
					<Placement
						color={activation.color}
						finalizer={activation.finalizer.poll}
					/>
				{:else if activation.type === "lookup"}
					<Lookup finalizer={activation.finalizer.poll} />
				{/if}
			</CanvasSpace>
		{/if}
	{/each}
	<Ui {site} {board} bind:state bind:settings />
	{#if typeof state.pointer !== "undefined"}
		{#if (!pointerOnBoard || typeof reticulePosition === "undefined") && typeof pointerPosition !== "undefined"}
			<Exact
				x={pointerPosition.x * boardSize.x - RETICULE_SIZE / 2}
				y={pointerPosition.y * boardSize.y - RETICULE_SIZE / 2}
				width={RETICULE_SIZE}
				height={RETICULE_SIZE}
			>
				<Reticule pointer={state.pointer} />
			</Exact>
		{/if}
	{/if}
</InputCapture>
