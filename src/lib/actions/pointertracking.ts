import { Vec2 } from "ogl";
import type { Action } from "svelte/action";
import { writable, type Writable, type Readable } from "svelte/store";

const root = document;

export enum TrackingAxis {
	Vertical,
	Horizontal,
};

export interface TrackingState {
	farthestDistance: number;
	axis: TrackingAxis | undefined;
	complete: boolean;
	point: Vec2;
	delta: Vec2;
}

type AxisLockFunction = (delta: Vec2) => TrackingAxis | undefined;

let trackedPoints = [] as Array<{
	start: Vec2;
	tryLockAxis: AxisLockFunction;
	state: Writable<TrackingState>;
}>;

function beginTracking(
	start: Vec2,
	tryLockAxis: AxisLockFunction = () => undefined,
) {
	const state = writable({
		farthestDistance: 0,
		axis: tryLockAxis(new Vec2(0, 0)),
		complete: false,
		point: start,
		delta: new Vec2(0, 0),
	});
	trackedPoints.push({ start, tryLockAxis, state });
	return state as Readable<TrackingState>;
}

function track(point: Vec2) {
	for (const data of trackedPoints) {
		const delta = point.clone().sub(data.start);
		const distance = delta.len();
		data.state.update((state) => {
			state.delta = delta;
			state.point = point;
			state.farthestDistance = Math.max(distance, state.farthestDistance);
			if (typeof state.axis === "undefined") {
				state.axis = data.tryLockAxis(delta);
			}
			return state;
		});
	}
}

function untrack() {
	for (const data of trackedPoints) {
		data.state.update((state) => {
			state.complete = true;
			return state;
		});
	}

	trackedPoints = [];
}

root.addEventListener("pointermove", (event) => {
	if (event.pointerType !== "touch") {
		const position = new Vec2(event.clientX, event.clientY);
		track(position);
	}
});

root.addEventListener("touchmove", (event) => {
	if (event.touches.length !== 1) {
		untrack();
		return;
	}

	const touch = event.touches[0];
	const position = new Vec2(touch.clientX, touch.clientY);
	track(position);
});

root.addEventListener("pointerup", (event) => {
	if (event.pointerType !== "touch") {
		untrack();
	}
});

root.addEventListener("touchend", (event) => {
	if (event.touches.length === 0) {
		untrack();
	}
});

function decideAxis(delta: Vec2, bias: number = 1, treshold = 10) {
	const movementHorizontal = Math.abs(delta.x);
	const movementVertical = Math.abs(delta.y / bias);
	// a measurement of how much horizontal movement there is compared to vertical.
	// positive values indicate a horizontal movement and negative indicate vertical movement.
	const ratio = movementHorizontal - movementVertical;
	if (ratio > treshold) {
		return TrackingAxis.Horizontal;
	} else if (-ratio > treshold) {
		return TrackingAxis.Vertical;
	} else {
		return undefined;
	}
}

export interface PointerTrackingParameters {
	axisLimit: TrackingAxis;
	axisBias: number;
	onPress: (this: HTMLElement, state: TrackingState) => unknown;
	onMove: (this: HTMLElement, state: TrackingState) => unknown;
	onRelease: (this: HTMLElement, state: TrackingState) => unknown;
	onCancel: (this: HTMLElement) => unknown;
}

const trackpointer = function (node, parameters) {
	let axisFunction: AxisLockFunction = () => undefined;
	switch (parameters.axisLimit) {
		case TrackingAxis.Horizontal:
			axisFunction = delta => decideAxis(delta, parameters.axisBias);
			break;
		case TrackingAxis.Vertical:
			axisFunction = delta => decideAxis(delta, parameters.axisBias);
			break;
	}

	let cancelled = false;
	function begin(position: Vec2) {
		cancelled = false;
		beginTracking(position, axisFunction).subscribe((newstate) => {
			if (cancelled) {
				return;
			}
			if (newstate.complete) {
				parameters.onRelease?.call(node, newstate);
			} else if (newstate.farthestDistance === 0) {
				parameters.onPress?.call(node, newstate);
			} else if (newstate.axis !== parameters.axisLimit && typeof newstate.axis !== "undefined") {
				cancelled = true;
				parameters.onCancel?.call(node);
			} else {
				parameters.onMove?.call(node, newstate);
			}
		});
	}

	node.addEventListener("pointerdown", (event) => {
		if (event.pointerType !== "touch") {
			const position = new Vec2(event.clientX, event.clientY);
			begin(position);
		}
	});

	node.addEventListener("touchstart", (event) => {
		if (event.touches.length === 1) {
			const touch = event.touches[0];
			const position = new Vec2(touch.clientX, touch.clientY);
			begin(position);
		}
	});

	return {
		update: (parameters) => {
			// TODO
		},
		destroy: () => {
			// TODO
		},
	};
} as Action<HTMLElement, Partial<PointerTrackingParameters>>;

export default trackpointer;
