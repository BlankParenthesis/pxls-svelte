<script context="module" lang="ts">
	const vertex = /* glsl */ `
		attribute vec2 position;
		attribute vec2 uv;
		attribute float bufferSource;

		varying vec2 vUv;
		//varying float vBufferSource;

		uniform vec2 uTranslate;
		uniform vec2 uScale;

		void main() {
			//vBufferSource = bufferSource;
			vUv = uv;
			gl_Position = vec4(uScale * (position + uTranslate), 0.0, 1.0);
		}
	`;

	const fragment = /* glsl */ `
		precision highp float;
				
		varying vec2 vUv;
		//varying float vBufferSource;
		
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

	const quad = [
		-1, 1,
		-1, -1,
		1, 1,
		1, -1,
		1, 1,
		-1, -1,
	];
	const quadNormals = [
		0, 1,
		0, 0,
		1, 1,
		1, 0,
		1, 1,
		0, 0,
	];
</script>
<script lang="ts">
	import { onMount } from "svelte";
	import { Renderer, Program, Mesh, Geometry, Vec2, Texture } from "ogl-typescript";

	let canvas: HTMLCanvasElement;
	let renderer: Renderer;
	let program: Program;
	let mesh: Mesh;
	let translate = new Vec2(0, 0);
	let scale = new Vec2(0.5, 0.5);
	let detailLevel = 0;

	let autoDetail = false;
	let renderIdentity = false;
	$: dummy = requestAnimationFrame(render)
		&& (detailLevel = detailLevel)
		&& (autoDetail = autoDetail)
		&& (renderIdentity = renderIdentity);

	function render(timestamp: DOMHighResTimeStamp) {
		const scaleBase = 3;

		if (autoDetail) {
			const minScale = Math.min(scale[0], scale[1]);
			detailLevel = Math.max(0, Math.floor(Math.log(minScale) / Math.log(scaleBase)));
		}

		const scaleModifier = scaleBase ** detailLevel;

		program.uniforms.uTranslate.value = new Vec2(...[translate[0], translate[1]].map(translate => {
			// Tiles are -1 to 1 (a length of 2).
			// So our magic numbers of 2 here are tile length.
			let excess = 0;
			let scaledTranslate = translate * scaleModifier
			// Worked this out through experimenting, so I don't know quite why.
			// this works.
			const scaleEdge = scaleBase ** (detailLevel + 1) - 1;
			if (Math.abs(scaledTranslate) >= scaleEdge) {
				// Since I don't know why scaleEdge is what it is, I don't quite 
				// know why it works out here. Though I imagine the -2 is actually
				// a -3 when combined with the -1 on scaleEdge, which would be -scaleBase.
				// Yay; programming through trial-and-error.
				excess = scaledTranslate - (scaleEdge - 2) * Math.sign(scaledTranslate);
				scaledTranslate = 0;
			}
			return scaledTranslate % 2 + excess;
		}));
		program.uniforms.uScale.value = new Vec2(...[scale[0], scale[1]].map(scale => {
			return scale / scaleModifier;
		}));

		renderer.autoClear = renderIdentity;
		renderer.render({
			scene: mesh,
		});

		if (renderIdentity) {
			program.uniforms.uTranslate.value = translate;
			renderer.autoClear = false;
			program.uniforms.uScale.value = scale;
			renderer.render({
				scene: mesh,
			});
		}
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
		
		// sets the aspect ratio to match screen.
		if (scale[0] > scale[1]) {
			scale[0] = scale[1] * window.innerHeight / window.innerWidth;
		} else {
			scale[1] = scale[0] * window.innerWidth / window.innerHeight;
		}

		requestAnimationFrame(render);
	}

	onMount(() => {
		renderer = new Renderer({ canvas });
		console.assert(renderer.gl.canvas === canvas);
		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		// 3×3 quad grid
		const geometry = new Geometry(gl, {
			position: { size: 2, data: new Float32Array([
				...quad.map((c) => c - 2),
				...quad.map((c, i) => i % 2 ? c - 2 : c),
				...quad.map((c, i) => i % 2 ? c - 2 : c + 2),
				...quad.map((c, i) => i % 2 ? c : c - 2),
				...quad,
				...quad.map((c, i) => i % 2 ? c: c + 2),
				...quad.map((c, i) => i % 2 ? c + 2 : c - 2),
				...quad.map((c, i) => i % 2 ? c + 2 : c),
				...quad.map((c) => c + 2),
			]) },
			uv: { size: 2, data: new Float32Array([
				...quadNormals,
				...quadNormals,
				...quadNormals,
				...quadNormals,
				...quadNormals,
				...quadNormals,
				...quadNormals,
				...quadNormals,
				...quadNormals,
			]) },
			//bufferSource: { size: 1, data: new Uint32Array([0, 1, 1, 0]) },
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
				uTranslate: { value: new Vec2(translate[0], translate[1]) },
				uScale: { value: new Vec2(scale[0], scale[1]) },
				tPalette: { value: palette },
				tCanvas: { value: canvasdata },
			},
		});
		
		mesh = new Mesh(gl, { geometry, program });

		resize();
	})
</script>

<svelte:window on:resize="{resize}" />

<canvas on:mousemove="{drag}" on:wheel="{zoom}" bind:this={canvas} />
<aside id="buttons">
	<div>
		<output><abbr title="Level of Detail">LoD</abbr>: {detailLevel}</output>
		<label><input bind:checked="{autoDetail}" type="checkbox"/>Auto LoD</label>
		<button disabled="{autoDetail}" on:click="{() => detailLevel += 1}">+</button>
		<button disabled="{autoDetail}" on:click="{() => detailLevel -= 1}">-</button>
	</div>
	<div>
		<label><input bind:checked="{renderIdentity}" type="checkbox"/>Show Reference</label>
	</div>
</aside>

<style>
	aside {
		display: flex;
		flex-direction: column;
		position: absolute;
		top: .5em;
		right: .5em;
		gap: .5em;
	}

	aside > div {
		display: flex;
		align-items: center;
		justify-content: right;
		gap: .5em;
	}

	button, output, label {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: x-large;
		font-weight: bold;
		font-family: monospace;
		padding:  .25em .5em;
	}

	output, label {
		background-color: aliceblue;
		border-style: outset;
		border-width: 1px;
		border-color: #77b;
		border-radius: .25em;
	}

	input[type="checkbox"] {
		margin-left: 0;
	}
</style>