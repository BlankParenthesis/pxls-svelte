<script lang="ts">
    import { Vec2 } from "ogl";
	import { Board } from "../lib/board/board";
    import { ActivationFinalizer, type AppState } from "../lib/settings";
    import { linearRegression } from "../lib/util";

	export let board: Board;
	export let state: AppState;
	const info = board.info; // TODO: listen to the palette directly

	$: pointerDefined = typeof state.pointer !== "undefined";
	$: placing = state.pointer?.type === "place";
	$: selectedColor = (pointerDefined && placing)
		/* @ts-expect-error: Validated through the above checks */
		? state.pointer.selected
		: undefined;

	let movedDistance = 0;

	function toggleColor(index: number) {
		const color = $info.palette.get(index);
		if (typeof color === "undefined") {
			throw new Error("invalid color");
		}
		
		if (state.pointer?.type === "place" && state.pointer.selected === index) {
			deselectColor();
		} else {
			movedDistance = 0;
			const background = "#" + colorToHex(color.value);
			state.pointer = {
				type: "place",
				quickActivate: true,
				selected: index,
				background,
				activate(position) {
					let task: Promise<void>;
					if (typeof position === "undefined") {
						task = new Promise((_, err) => err("Invalid Location"));
					} else {
						task = board.place(position, index, state.adminOverrides)
							.then(success => {
								if (!success) {
									throw new Error("Placing failed");
								}
							});
					}
					return {
						type: "place",
						background,
						position,
						task,
						finalizer: new ActivationFinalizer(),
					};
				},
			};
		}
	}

	const DISTANCE_THRESHOLD = 10;
	function deselectColor() {
		if (movedDistance > DISTANCE_THRESHOLD) {
			state.pointer = undefined;
		} else if (state.pointer?.quickActivate) {
			state.pointer.quickActivate = false;
		} else {
			state.pointer = undefined;
		}
	}

	function colorToHex(color: number) {
		return color.toString(16).padStart(8, "0");
	}

	let scrollRoot: HTMLElement;
	let initialScrollPoint: {
		pointer: Vec2,
		scroll: Vec2,
	} | undefined;
	let recentScrollPoints = [] as Array<{
		point: Vec2,
		time: number,
	}>;
	let scrollVelocity = new Vec2(0, 0);
	function beginScroll(pointer: Vec2) {
		const scrollBounds = scrollRoot.getBoundingClientRect();
		const maxScroll = new Vec2(
			scrollRoot.scrollWidth - scrollBounds.width,
			scrollRoot.scrollTop - scrollBounds.height,
		);
		const scroll = new Vec2(
			scrollRoot.scrollLeft,
			scrollRoot.scrollTop,
		).divide(maxScroll);
		initialScrollPoint = { pointer, scroll };
		recentScrollPoints = [];
		scrollVelocity.x = scrollVelocity.y = 0;
	}
	
	function trimScrollPoints() {
		const now = Date.now();
		const recencyThreshold = now - 200;
		const firstValidVector = recentScrollPoints.findIndex(v => v.time > recencyThreshold);
		if (firstValidVector === -1) {
			recentScrollPoints = [];
		} else {
			recentScrollPoints.splice(0, firstValidVector);
		}
	}
	
	function calculateScrollFling() {
		const first = recentScrollPoints.shift();
		const last = recentScrollPoints[recentScrollPoints.length - 1];
		if (typeof first !== "undefined" && typeof last !== "undefined") {
			const distanceByTime = recentScrollPoints.map(v => {
				const distance = v.point.distance(first.point);
				const time = v.time - first.time;
				return [time, distance] as [number, number];
			});
			
			// Fit a line to the distance / time data.
			// A fling drag is close to a straight line (distance increases linearly with time)
			// A drag + stop has a non-linear shape and therefor a lower correlation.
			const { slope, correlation } = linearRegression(distanceByTime);
			
			if (correlation > 0.96) {
				const difference = last.point.sub(first.point)
					.normalize()
					.multiply(slope); // slope is distance / time = velocity
				return difference;
			}
		}

		// Assume no velocity by default
		return new Vec2(0, 0);
	}
	
	function doScroll(point: Vec2) {
		if (typeof scrollRoot !== "undefined" && typeof initialScrollPoint !== "undefined") {
			const scrollBounds = scrollRoot.getBoundingClientRect();
			const _containedHorizontal = scrollBounds.x <= point.x && scrollBounds.x + scrollBounds.width >= point.x;
			const containedVertical = scrollBounds.y <= point.y && scrollBounds.y + scrollBounds.height >= point.y;
			if (containedVertical) {
				trimScrollPoints();
				const time = Date.now();
				recentScrollPoints.push({ time, point });
				
				const initialPoint = initialScrollPoint.pointer.clone();
				const initialScroll = initialScrollPoint.scroll.clone();
				const scrollDelta = initialPoint.sub(point);
				const maxScroll = new Vec2(
					scrollRoot.scrollWidth - scrollBounds.width,
					scrollRoot.scrollTop - scrollBounds.height,
				);
				const initialScrollPixels = initialScroll.multiply(maxScroll);
				scrollRoot.scrollLeft = initialScrollPixels.x + scrollDelta.x;
				scrollRoot.scrollTop = initialScrollPixels.y + scrollDelta.y;
				
				if (Math.abs(scrollDelta.x) > 40) {
					state.pointer = undefined;
				}
			} else {
				stopScroll();
			}
		}
	}
	
	function trackPointer(event: PointerEvent) {
		movedDistance += Math.sqrt(event.movementX ** 2 + event.movementY ** 2);
		doScroll(new Vec2(event.clientX, event.clientY));
	}

	let lastTouchPosition: Vec2 | undefined;
	function trackTouch(event: TouchEvent) {
		if (event.touches.length === 1) {
			const touch = event.touches[0];
			const position = new Vec2(touch.pageX, touch.pageY);
			if (typeof lastTouchPosition !== "undefined") {
				movedDistance += position.distance(lastTouchPosition);
			}
			lastTouchPosition = position;
			doScroll(position);
		} else {
			movedDistance = Infinity;	
		}
	}
	
	function stopScroll() {
		initialScrollPoint = undefined;
		scrollVelocity = calculateScrollFling();
		requestAnimationFrame(scrollPhysics);
	}
	
	let lastTime: number | undefined;
	function scrollPhysics(time: number) {
		if (typeof lastTime === "undefined") {
			lastTime = time;
		}
		const delta = time - lastTime;
		
		if (delta === 0) {
			requestAnimationFrame(scrollPhysics);
			return;
		}
		
		if (scrollVelocity.x !== 0 || scrollVelocity.y !== 0) {
			if (scrollRoot) {
				scrollRoot.scrollLeft -= scrollVelocity.x * delta;
				scrollRoot.scrollTop -= scrollVelocity.y * delta;
			}
			
			// drag
			scrollVelocity.multiply(0.997 ** delta);
			
			if (Math.abs(scrollVelocity.x) < 1e-6) {
				scrollVelocity.x = 0;
			}
			
			if (Math.abs(scrollVelocity.y) < 1e-6) {
				scrollVelocity.y = 0;
			}
			
			requestAnimationFrame(scrollPhysics);
			lastTime = time;
		} else {
			lastTime = undefined;
		}
	}
</script>
<style>
	ul {
		margin: 0;
		padding: .75em;

		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
		justify-content: center;
		
		flex-wrap: nowrap;
		overflow-x: scroll;
		justify-content: start;
		
		/* try to prevent the browser from scrolling the element while dragging */
		touch-action: none;
		user-select: none;
	}

	li {
		list-style-type: none;
	}

	.color {
		width: 2.5em;
		height: 2.5em;
		box-sizing: border-box;
		background-position: 0 0, 0 0, 50% 50%;
		background-size: auto, 50% 50%, 50% 50%;
		
		--transparent-dark: #7E7F83;
		--transparent-light: #C1C1C3;

		background-image: linear-gradient(var(--color), var(--color)),
			repeating-linear-gradient(45deg, var(--transparent-light) 25%, transparent 25%, transparent 75%, var(--transparent-light) 75%, var(--transparent-light)),
			repeating-linear-gradient(45deg, var(--transparent-light) 25%, var(--transparent-dark) 25%, var(--transparent-dark) 75%, var(--transparent-light) 75%, var(--transparent-light));
	}

	.color.selected {
		background: transparent !important;
		border-style: dashed;
	}
</style>
<svelte:window
	on:pointermove={trackPointer}
	on:pointerup={e => {
		if (e.pointerType !== "touch") {
			stopScroll();
		}
	}}
	on:touchmove={trackTouch}
	on:touchend={e => {
		if (e.touches.length === 0) {
			stopScroll();
		}
	}}
/>
<ul
	on:pointerdown={e => {
		if (e.pointerType !== "touch") {
			beginScroll(new Vec2(e.clientX, e.clientY));
		}
	}}
	on:touchstart={e => {
		if (e.touches.length === 1) {
			const touch = e.touches[0];
			beginScroll(new Vec2(touch.pageX, touch.pageY));
		}
	}}
	bind:this={scrollRoot}
	tabindex="-1"
>
	{#each $info.palette as [index, color]}
		{#if !color.system_only || state.adminOverrides.color }
			<li>
				<button
					on:keydown={e => {
						if ([" ", "Enter"].includes(e.key)) {
							// A bit of a hack to prevent keyboard deselect from
							// being blocked by the quick place mechanism
							movedDistance = DISTANCE_THRESHOLD + 1;
							toggleColor(index);
						}
					}}
					on:pointerdown={e => {
						if (e.pointerType !== "touch") {
							toggleColor(index);
						}
					}}
					on:pointerup={e => {
						if (e.pointerType !== "touch") {
							deselectColor();
						}
					}}
					on:touchstart={e => {
						if (e.touches.length === 1) {
							toggleColor(index);
						}
					}}
					on:touchend={e => {
						if (e.touches.length === 0) {
							// because target is retained for touchend events,
							// we might be placing. If so, deselecting now would
							// interrupt the place code as this has higher 
							// precedence.
							// Instead, run it the next event loop:
							setTimeout(deselectColor, 0);
						}
					}}
					style="--color: #{colorToHex(color.value)}"
					class:selected={selectedColor === index}
					class="color"
				/>
			</li>
		{/if}
	{/each}
</ul>
