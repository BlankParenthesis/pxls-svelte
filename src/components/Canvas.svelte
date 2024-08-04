<script lang="ts">
    import { Vec2 } from "ogl";
	import type { GameState } from "../lib/util";
	import type { Board } from "../lib/board/board";
	import type { RenderParameters } from "../lib/render/canvas";
    import type { RendererOverrides } from "../lib/settings";
	import Render from "./Render.svelte";
    import Reticule from "./Reticule.svelte";

	let canvas: Render;

	export let board: Board;
	export let overrides: RendererOverrides;
	export let parameters: RenderParameters;
	export let gamestate: GameState;

	let innerWidth: number;
	let innerHeight: number;
	$: width = innerWidth;
	$: height = innerHeight;
	
	const info = board.info;
	$: reticuleSize = Math.min(parameters.transform[0], parameters.transform[4])
		* Math.max(window.innerWidth, window.innerHeight)
		/ Math.max(...$info.shape.size())
		/ 2;


	let [boardWidth, boardHeight] = $info.shape.size();
	let reticulePosition = new Vec2(0, 0);

	function positionReticule(mouseX: number, mouseY: number) {
		const x = mouseX / width;
		const y = mouseY / height;
		const viewbox = canvas.viewbox();
		const [boardX, boardY] = viewbox.into(x, y);
		const pixelsX = Math.floor(boardX * boardWidth);
		const pixelsY = Math.floor(boardY * boardHeight);
		const [x2, y2] = viewbox.outof(pixelsX / boardWidth, pixelsY / boardHeight);

		reticulePosition = new Vec2(x2 * width, y2 * height);
	}

	async function place(x: number, y: number) {
		if (typeof gamestate.selectedColor !== "undefined") {
			await board.place(x, y, gamestate.selectedColor);
		} else {
			throw new Error("Placed with no color selected");
		}
	}

	let dragAnchor: Vec2 | undefined;
	let clicking = false;

	function drag(event: MouseEvent) {
		positionReticule(event.clientX, event.clientY);
		
		// TODO: a bunch of stuff, but mainly we can do nasty things like place through the ui
		
		if (event.buttons === 1) {
			const dx = 2 * event.movementX / width;
			const dy = 2 * event.movementY / height;
			const scale = new Vec2(parameters.transform[0], parameters.transform[4]);
			parameters.transform = parameters.transform
				.translate(new Vec2(dx, dy)
				.divide(scale));
		}

		// TODO: use this for dragging
		//const viewbox = canvas.viewbox();
		//const [boardX, boardY] = viewbox.into(event.clientX, event.clientY);
		//if (event.buttons === 0) {
		//	dragAnchor = undefined;
		//} else if (typeof dragAnchor === "undefined") {
		//	dragAnchor = new Vec2(boardX, boardY);
		//} else {
		//	const dragDelta = new Vec2(boardX, boardY).sub(dragAnchor);
		//}

		if (typeof gamestate.selectedColor !== "undefined") {
			const position = new Vec2(event.clientX, event.clientY);
			if (event.buttons === 0) {
				if (clicking && event.target) {
					clicking = false;
					const x = event.clientX / width;
					const y = event.clientY / height;
					const viewbox = canvas.viewbox();
					const [boardX, boardY] = viewbox.into(x, y);
					const pixelsX = Math.floor(boardX * boardWidth);
					const pixelsY = Math.floor(boardY * boardHeight);
					place(pixelsX, pixelsY);
				}
				dragAnchor = undefined;
			} else if (typeof dragAnchor === "undefined") {
				dragAnchor = position;
				clicking = true;
			} else {
				if (position.distance(dragAnchor) > 5) {
					clicking = false;
				}
			}
		}

	}

	async function zoom(event: WheelEvent) {

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

		// TODO: this scales from the top left rather than anything nice, fix that
		const zoom = 1.15 ** delta;
		parameters.transform = parameters.transform.scale(new Vec2(zoom, zoom));
		
		// TODO: this is out of date so displays wrong
		positionReticule(event.clientX, event.clientY);
	}
</script>
<!--TODO: perhaps use actions to make some nice controls module -->
<svelte:window bind:innerWidth bind:innerHeight on:mousemove={drag} on:wheel={zoom} on:mousedown={drag} on:mouseup={drag}/>
<Render bind:this={canvas} {board} {parameters} {overrides} {width} {height} />
<Reticule {gamestate} position={reticulePosition} size={reticuleSize} />
