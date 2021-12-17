<script context="module" lang="ts">
	const vertex = /* glsl */ `
		attribute vec2 position;
		attribute vec2 uv;
		attribute float bufferSource;

		varying vec2 vUv;

		uniform vec2 uTranslate;
		uniform vec2 uScale;

		void main() {
			vUv = uv;
			gl_Position = vec4(uScale * (position + uTranslate), 0.0, 1.0);
		}
	`;

	const fragment = /* glsl */ `
		precision highp float;
				
		varying vec2 vUv;
		
		uniform sampler2D tPalette;
		uniform sampler2D tCanvas;

		void main() {
			vec4 canvasdata = texture2D(tCanvas, vUv);
			float index = floor(canvasdata.r * 255.0 + 0.5) / 3.0;
			gl_FragColor = texture2D(tPalette, vec2(index, 0.0));
		}
	`;

	const MOUSE_BUTTON_PRIMARY = 1;
	const MOUSE_BUTTON_SECONDARY = 2;
	const MOUSE_BUTTON_AUXILIARY = 4;
	const MOUSE_BUTTON_FOUR = 8;
	const MOUSE_BUTTON_FIVE = 16;
</script>
<script lang="ts">
	import { onMount } from "svelte";
	import { Renderer, Program, Mesh, Geometry, Vec2, Texture } from "ogl-typescript";

	let canvas: HTMLCanvasElement;
	let renderer: Renderer;
	let program: Program;
	let mesh: Mesh;
	let translate: Vec2;
	let scale: Vec2;

	function render(timestamp: DOMHighResTimeStamp) {
		renderer.render({
			scene: mesh,
		});
	}

	function drag(event: MouseEvent) {
		if (event.buttons & MOUSE_BUTTON_PRIMARY) {
			translate[0] += 2 * event.movementX / canvas.width / scale[0];
			translate[1] += -2 * event.movementY / canvas.height / scale[1];
			requestAnimationFrame(render);
		}
	}

	function zoom(event: WheelEvent) {
		const oldScale = new Vec2(scale[0], scale[1]);

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

		scale[0] *= 1.15 ** delta;
		scale[1] *= 1.15 ** delta;

		const zoomCenterX = 2 * (event.clientX / canvas.width) - 1;
		const zoomCenterY = -2 * (event.clientY / canvas.height) + 1;
		
		translate[0] -= zoomCenterX / oldScale[0];
		translate[0] += zoomCenterX / scale[0];
		translate[1] -= zoomCenterY / oldScale[1];
		translate[1] += zoomCenterY / scale[1];
		
		requestAnimationFrame(render);
	}

	function resize() {
		renderer.setSize(window.innerWidth, window.innerHeight);
		
		scale[0] = scale[1] * window.innerHeight / window.innerWidth;

		requestAnimationFrame(render);
	}

	onMount(() => {
		renderer = new Renderer({ canvas });
		console.assert(renderer.gl.canvas === canvas);
		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		const geometry = new Geometry(gl, {
			position: { size: 2, data: new Float32Array([
				-1, 1,
				-1, -1,
				1, 1,
				1, -1,
			]) },
			uv: { size: 2, data: new Float32Array([
				0, 1,
				0, 0,
				1, 1,
				1, 0,
			]) },
			index: { data: new Uint16Array([0, 1, 2, 3, 2, 1]) },
		});

		const palette = new Texture(gl, {
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});
		const paletteImage = new Image();
		paletteImage.onload = () => {
			palette.image = paletteImage;
			requestAnimationFrame(render);
		};
		paletteImage.src = "./palette.png"

		const canvasdata = new Texture(gl, {
			magFilter: gl.NEAREST,
			minFilter: gl.NEAREST,
		});
		const canvasdataImage = new Image();
		canvasdataImage.onload = () => {
			canvasdata.image = canvasdataImage;
			requestAnimationFrame(render);
		};
		canvasdataImage.src = "./canvas.png"

		program = new Program(gl, {
			vertex,
			fragment,
			uniforms: {
				uTranslate: { value: new Vec2(0, 0) },
				uScale: { value: new Vec2(0.5, 0.5) },
				tPalette: { value: palette },
				tCanvas: { value: canvasdata },
			},
		});

		mesh = new Mesh(gl, { geometry, program });
		translate = program.uniforms.uTranslate.value as Vec2;
		scale = program.uniforms.uScale.value as Vec2;

		resize();
	})
</script>

<svelte:window on:resize="{resize}" />

<canvas on:mousemove="{drag}" on:wheel="{zoom}" bind:this={canvas} />