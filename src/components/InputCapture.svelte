<script lang="ts">
	import { Vec2 } from "ogl";

	export let ongrab: (points: Array<Vec2>) => unknown;
	export let ondrag: (points: Array<Vec2>) => unknown;
	export let oncancel: () => unknown;

	export let ondrop: (point: Vec2, target: Element) => unknown;
	export let onpoint: (point: Vec2, target: Element | null) => unknown;

	export let onbounds: (bounds: DOMRect) => unknown;

	let element: HTMLElement;
	let sizeObserver = new ResizeObserver((entries) => {
		if (entries.length > 0) {
			onbounds(entries[entries.length - 1].contentRect);
		}
	});

	$: if (element) {
		sizeObserver.observe(element);
	}

	function getBounds() {
		const bounds = element.getBoundingClientRect();
		// set bounds to be relative to document root rather than screen
		bounds.x += document.documentElement.scrollLeft;
		bounds.y += document.documentElement.scrollTop;
		return bounds;
	}

	function eventToPoint(event: MouseEvent) {
		const bounds = getBounds();
		return new Vec2(
			(event.pageX - bounds.x) / bounds.width,
			(event.pageY - bounds.y) / bounds.height,
		);
	}

	function touchToPoint(touch: Touch) {
		const bounds = getBounds();
		return new Vec2(
			(touch.pageX - bounds.x) / bounds.width,
			(touch.pageY - bounds.y) / bounds.height,
		);
	}

</script>
<style>
	.capture {
		overflow: hidden;
	}
	.stack {
		position: relative;
	}
	.stack > :global(*) {
		position: absolute;
		inset: 0;
		overflow: visible;
	}
</style>
<svelte:window
	on:pointermove={(event) => {
		if (event.pointerType !== "touch") {
			if (event.pressure > 0) {
				if (typeof element !== "undefined") {
					ondrag([eventToPoint(event)]);
				}
			}
		}
	}}
	on:pointerup={(event) => {
		if (event.pointerType !== "touch") {
			oncancel();
		}
	}}
	on:pointercancel={oncancel}

	on:touchmove={(event) => {
		ondrag(Array.from(event.touches).map(touchToPoint));
	}}
	on:touchend={(event) => {
		if (event.touches.length === 0) {
			const point = new Vec2(
				event.changedTouches[0].pageX,
				event.changedTouches[0].pageY,
			);
			const target = document.elementFromPoint(point.x, point.y);
			if (target !== null && typeof element !== "undefined") {
				const bounds = getBounds();
				point.divide(new Vec2(bounds.width, bounds.height));
				ondrop(point, target);
			}
		} else {
			// we still have more touches, recenter the drag:
			ongrab(Array.from(event.touches).map(touchToPoint));
		}
	}}
	on:touchcancel={oncancel}
/>
<div
	class="capture stack"
	on:pointermove={(event) => {
		const target = document.elementFromPoint(event.clientX, event.clientY);
		if (typeof element !== "undefined") {
			onpoint(eventToPoint(event), target);
		}
	}}
	on:pointerleave
	bind:this={element}
>
	<slot></slot>
</div>
