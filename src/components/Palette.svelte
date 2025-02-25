<!-- this comment is a workaround for https://github.com/sveltejs/eslint-plugin-svelte/pull/970 -->
<script lang="ts">
	import { Vec2 } from "ogl";
	import { Board } from "../lib/board/board";
	import type { AppState } from "../lib/settings";
	import { ActivationFinalizer } from "../lib/pointer";
	import { DRAG_DISTANCE_THRESHOLD, linearRegression } from "../lib/util";
	import { onDestroy } from "svelte";
	import { Pixel } from "../lib/pixel";
	import pointertracking, { TrackingAxis } from "../lib/actions/pointertracking";
	import { play as playSound, Sound } from "../lib/sound";

	export let board: Board;
	export let state: AppState;
	const info = board.info; // TODO: listen to the palette directly

	// how much scrolling should be preferred over placing when dragging.
	// greater than one is higher preference, lower is less.
	// corresponds to the gradient of mouse movement.
	const SCROLL_BIAS = 1 / 3;

	$: pointerDefined = typeof state.pointer !== "undefined";
	$: placing = state.pointer?.type === "place";
	$: selectedColor = (pointerDefined && placing)
		/* @ts-expect-error: Validated through the above checks */
		? state.pointer.selected
		: undefined;

	function toggleColor(index: number) {
		if (state.pointer?.type === "place" && state.pointer.selected === index) {
			deselectColor();
		} else {
			selectColor(index);
		}
	}

	function selectColor(index: number) {
		const color = $info.palette.get(index);
		if (typeof color === "undefined") {
			playSound(Sound.Error);
			throw new Error("invalid color");
		}
		playSound(Sound.Select);

		const colorString = "#" + colorToHex(color.value);
		state.pointer = {
			type: "place",
			quickActivate: true,
			selected: index,
			color: colorString,
			activate(position) {
				let task: Promise<Pixel>;
				if (typeof position === "undefined") {
					// TODO: this doesn't seem to error correctly
					task = new Promise((_, err) => err("Invalid Location"));
				} else {
					const [sector, offset] = $info.shape.positionToSector(position);
					const existingColor = board.colors(sector).then(c => c[offset]);
					task = existingColor
						.then((color) => {
							if (color === index) {
								throw new Error("Color Matches");
							} else {
								return board.place(position, index, state.adminOverrides);
							}
						})
						.then((pixel) => {
							if (typeof pixel === "undefined") {
								throw new Error("Placing failed");
							} else {
								return pixel;
							}
						});
				}
				playSound(Sound.PlaceBegin);
				task.then(() => playSound(Sound.PlaceOk))
					.catch(() => playSound(Sound.PlaceError));
				return {
					type: "place",
					color: colorString,
					position,
					task,
					finalizer: new ActivationFinalizer(),
				};
			},
		};
	}

	function hardSelect() {
		if (state.pointer?.type === "place") {
			state.pointer.quickActivate = false;
		}
	}

	function deselectColor() {
		if (state.pointer?.type === "place") {
			playSound(Sound.Deselect);
			state.pointer = undefined;
		}
	}

	function colorToHex(color: number) {
		return color.toString(16).padStart(8, "0");
	}

	function maxScroll(): Vec2 {
		const scrollBounds = scrollRoot.getBoundingClientRect();
		return new Vec2(
			scrollRoot.scrollWidth - scrollBounds.width,
			scrollRoot.scrollTop - scrollBounds.height,
		);
	}

	function currentScroll(): Vec2 {
		return new Vec2(
			scrollRoot.scrollLeft,
			scrollRoot.scrollTop,
		).divide(maxScroll());
	}

	let scrollRoot: HTMLElement;
	let initialScroll = new Vec2(0, 0);
	let recentScrollPoints = [] as Array<{
		point: Vec2;
		time: number;
	}>;

	function trimScrollPoints() {
		const now = Date.now();
		const recencyThreshold = now - 100;
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
			const distanceByTime = recentScrollPoints.map((v) => {
				const distance = v.point.distance(first.point);
				const time = v.time - first.time;
				return [time, distance] as [number, number];
			});

			// Fit a line to the distance / time data.
			// A fling drag is close to a straight line (distance increases linearly with time)
			// A drag + stop has a non-linear shape and therefor a lower correlation.
			const { slope, correlation } = linearRegression(distanceByTime);

			if (correlation > 0.96) {
				const difference = first.point.sub(last.point)
					.normalize()
					.multiply(slope); // slope is distance / time = velocity
				return difference;
			}
		}

		// Assume no velocity by default
		return new Vec2(0, 0);
	}

	let scrollVelocity = new Vec2(0, 0);
	let scrollPosition: Vec2 | undefined;

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
			if (scrollRoot && typeof scrollPosition !== "undefined") {
				const max = maxScroll();
				scrollPosition.add(scrollVelocity.clone().multiply(delta));
				scrollRoot.scrollLeft = scrollPosition.x * max.x;
				scrollRoot.scrollTop = scrollPosition.y * max.y;

				if (0 > scrollPosition.x || scrollPosition.x > 1) {
					scrollVelocity.x = 0;
				}

				if (0 > scrollPosition.y || scrollPosition.y > 1) {
					scrollVelocity.y = 0;
				}
			}

			// drag
			scrollVelocity.multiply(0.995 ** delta);

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

	onDestroy(() => {
		if (state.pointer?.type === "place") {
			state.pointer = undefined;
		}
	});
</script>
<style>
	ul {
		margin: 0;
		padding: .75em;

		display: flex;
		gap: 0.5em;

		flex-wrap: nowrap;
		overflow-x: auto;
		justify-content: start;
		/*
			Not massively supported, but decent support.
			We can't just use "center" because this interacts poorly with overflow.
		*/
		justify-content: safe center;

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
<ul
	use:pointertracking={{
		axisLimit: TrackingAxis.Horizontal,
		axisBias: SCROLL_BIAS,
		onPress: () => {
			initialScroll = currentScroll();
			scrollVelocity.x = scrollVelocity.y = 0;
			recentScrollPoints = [];
		},
		onMove: ({ axis, delta, point }) => {
			trimScrollPoints();
			const time = Date.now();
			recentScrollPoints.push({ time, point });
			if (axis === TrackingAxis.Horizontal) {
				const initialScrollPixels = maxScroll().multiply(initialScroll);
				scrollRoot.scrollLeft = initialScrollPixels.x - delta.x;
				scrollRoot.scrollTop = initialScrollPixels.y - delta.y;
			}
		},
		onRelease: ({ axis }) => {
			if (axis === TrackingAxis.Horizontal) {
				scrollVelocity = calculateScrollFling().divide(maxScroll());
				scrollPosition = currentScroll();
				requestAnimationFrame(scrollPhysics);
			}
		},
	}}
	bind:this={scrollRoot}
	tabindex="-1"
>
	{#each $info.palette as [index, color]}
		{#if !color.system_only || state.adminOverrides.color }
			<li>
				<button
					class="color"
					class:selected={selectedColor === index}
					style="--color: #{colorToHex(color.value)}"
					on:keydown={(event) => {
						if ([" ", "Enter"].includes(event.key)) {
							toggleColor(index);
						}
					}}
					use:pointertracking={{
						axisLimit: TrackingAxis.Vertical,
						axisBias: 1 / SCROLL_BIAS,
						onPress: () => toggleColor(index),
						onRelease: ({ farthestDistance }) => {
							if (farthestDistance < DRAG_DISTANCE_THRESHOLD) {
								hardSelect();
							} else if (state.pointer?.quickActivate) {
								// because target is retained for touchend events,
								// we might be placing. If so, deselecting now would
								// interrupt the place code as this has higher
								// precedence.
								// Instead, run it the next event loop:
								setTimeout(deselectColor, 0);
							}
						},
						onCancel: () => deselectColor(),
					}}
				/>
			</li>
		{/if}
	{/each}
</ul>
