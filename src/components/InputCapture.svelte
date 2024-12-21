<script lang="ts">
    import { Vec2 } from "ogl";

	export let ongrab: (points: Array<Vec2>) => unknown;
	export let ondrag: (points: Array<Vec2>) => unknown;
	export let oncancel: () => unknown;
	
	export let ondrop: (point: Vec2, target: Element) => unknown;
	export let onpoint: (point: Vec2, target: Element | null) => unknown;
	
	export let onbounds: (bounds: DOMRect) => unknown;
			
	let element: HTMLElement;
	let sizeObserver = new ResizeObserver(entries => {
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
	on:pointermove={e => {
		if (e.pointerType !== "touch") {
			if (e.pressure > 0) {
				if (typeof element !== "undefined") {
					ondrag([eventToPoint(e)]);
				}
			}
		}
	}}
	on:pointerup={e => {
		if (e.pointerType !== "touch") {
			oncancel();
		}
	}}
	on:pointercancel={oncancel}

	on:touchmove={e => {
		ondrag(Array.from(e.touches).map(touchToPoint));
	}}
	on:touchend={e => {
		if (e.touches.length === 0) {
			const point = new Vec2(
				e.changedTouches[0].pageX,
				e.changedTouches[0].pageY,
			);
			const target = document.elementFromPoint(point.x, point.y);
			if (target !== null && typeof element !== "undefined") {
				const bounds = getBounds();
				point.divide(new Vec2(bounds.width, bounds.height));
				ondrop(point, target);
			}
		} else {
			// we still have more touches, recenter the drag:
			ongrab(Array.from(e.touches).map(touchToPoint));
		}
	}}
	on:touchcancel={oncancel}
/>
<div
	class="capture stack"
	on:pointermove={e => {
		const target = document.elementFromPoint(e.clientX, e.clientY);
		if (typeof element !== "undefined") {
			onpoint(eventToPoint(e), target);
		}
	}}
	on:pointerleave
	bind:this={element}
>
	<slot></slot>
</div>
