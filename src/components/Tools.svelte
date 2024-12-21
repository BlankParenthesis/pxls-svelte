<script lang="ts">
	import type { Board } from "../lib/board/board";
	import type { AppState, Settings } from "../lib/settings";
	import { durationStringShort } from "./Time.svelte";
	import { onDestroy } from "svelte";
	import { get, writable } from "svelte/store";
	import { ActivationFinalizer, type LookupData } from "../lib/pointer";

	export let board: Board;
	export let state: AppState;
	export let settings: Settings;
	export let access: Set<string>;

	const canIgnoreCooldown = access.has("boards.pixels.override.cooldown");
	const canUseStaffColors = access.has("boards.pixels.override.color");
	const canIgnoreMask = access.has("boards.pixels.override.mask");
	const hasAdminTool = canIgnoreCooldown || canUseStaffColors || canIgnoreMask;
	
	const canLookup = access.has("boards.pixels.get");

	// https://www.desmos.com/calculator/mlugvy8kwy
	const DURATION_KNOWN_POINT = 0.25; 
	const DURATION_KNOWN_POINT_VALUE = 3600; 
	const DURATION_POWER = 5; 
	const DURATION_COEFFICIENT = (DURATION_KNOWN_POINT_VALUE - 1) / Math.pow(DURATION_KNOWN_POINT, DURATION_POWER);

	function valueToDuration(range: number) {
		return Math.round(1 + DURATION_COEFFICIENT * Math.pow(range, DURATION_POWER));
	}

	function durationToValue(duration: number) {
		return Math.pow((duration - 1) / DURATION_COEFFICIENT, 1 / DURATION_POWER);
	}

	function manualStep(event: KeyboardEvent): number {
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				event.preventDefault();
				return 0.01;
			case "ArrowLeft":
			case "ArrowDown":
				event.preventDefault();
				return -0.01;
			default:
				return 0;
		}
	}

	let lastLookupDismisser: () => void | undefined;
	function setLookupPointer() {
		if (state.pointer?.type === "lookup") {
			state.pointer = undefined;
		} else {
			state.pointer = {
				type: "lookup",
				quickActivate: false,
				activate(position) {
					let task: Promise<LookupData>;
					if (typeof position === "undefined") {
						task = new Promise((_, err) => err("Invalid Location"));
					} else {
						if (typeof lastLookupDismisser !== "undefined") {
							lastLookupDismisser();
						}
						const dismissal = new Promise<void>(r => {
							lastLookupDismisser = r;
						});
						const lookup = board.pixel(position);
						const pixel = get(lookup);
						if (typeof pixel === "undefined") {
							throw new Error("Assertion failed: pixel lookup was immediately invalid");
						}
						task = pixel.then(() => {
							return {
								dismissal,
								lookup,
							};
						});
					}
					
					return {
						type: "lookup",
						position,
						task,
						finalizer: new ActivationFinalizer(),
					};
				},
			};
		}
	}

	let duration = durationToValue(settings.heatmap.duration);
	$: settings.heatmap.duration = valueToDuration(duration);
	let offset = durationToValue(-settings.heatmap.position);
	$: settings.heatmap.position = -valueToDuration(offset);

	onDestroy(() => {
		if (state.pointer?.type === "lookup") {
			state.pointer = undefined;
		}
		if (typeof lastLookupDismisser !== "undefined") {
			lastLookupDismisser();
		}
	});
</script>
<style>
	.admin-tools {
		text-align: left;
	}

	.user-tools {
		text-align: right;
	}

	.user-tools > * {
		text-align: left;
	}

	.tool {
		background: var(--tool-button-background);
	}
	
	.tool:hover {
		background: var(--tool-button-hover-background);
	}

	.tool.active {
		color: var(--tool-button-active-foreground);
		background: var(--tool-button-active-background);
	}
	
	.tool-group {
		gap: 0.5em;
		padding: 0.25em;
	}
</style>
<div class="flex reverse space cursor-transparent">
	<div class="user-tools tool-group flex align-bottom">
		{#if canLookup}
			<div class="flex vertical group reverse">
				<button class="button tool" class:active={state.pointer?.type === "lookup"} on:click={setLookupPointer}>
					<div class="icon large">🔍</div>
					<small>Inspect</small>
				</button>
			</div>
		{/if}
		<div class="flex vertical group reverse">
			<button
				class="button tool"
				class:active={settings.heatmap.enabled}
				on:click={() => settings.heatmap.enabled = !settings.heatmap.enabled}
			>
				<div class="icon large">🔥</div>
				<small>Activity</small>
			</button>
			{#if settings.heatmap.enabled}
				<!-- <label>
					<span class="inline-label">Offset: {printDurationRelative(-settings.heatmap.position - 1)}</span>
					<input
						type="range"
						class="flipped vertical"
						bind:value={offset}
						on:keydown={e => {
							// minus because we're flipped
							const newval = offset - manualStep(e);
							offset = Math.max(0, Math.min(newval, 1));
						}}
						list="activity-offset-stops"
						min="0"
						max="1"
						step="any"
					/>
					<datalist id="activity-offset-stops">
					</datalist>
				</label> -->
				<label class="flex vertical align-middle">
					<small class="high-contrast">
						{durationStringShort(settings.heatmap.duration)}
					</small>
					<input
						type="range"
						class="vertical flipped"
						bind:value={duration}
						on:keydown={e => {
							const newval = duration + manualStep(e);
							duration = Math.max(0, Math.min(newval, 1));
						}}
						list="activity-duration-stops"
						min="0"
						max="1"
						step="any"
					/>
					<datalist id="activity-duration-stops">
						<option value="0"></option> 
						<option value="{durationToValue(60)}"></option>
						<option value="{durationToValue(60 * 60)}"></option>
						<option value="{durationToValue(60 * 60 * 24)}"></option>
						<option value="{durationToValue(60 * 60 * 24 * 30)}"></option>
					</datalist>
				</label>
			{/if}
		</div>
	</div>
	{#if hasAdminTool}
		<div class="admin-tools tool-group flex wrap-reverse align-bottom">
			{#if canUseStaffColors}
				<button
					class="button tool"
					class:active={state.adminOverrides.color}
					on:click={() => state.adminOverrides.color = !state.adminOverrides.color}
				>Enable Admin Colors</button>
			{/if}
			{#if canIgnoreCooldown}
				<button
					class="button tool"
					class:active={state.adminOverrides.cooldown}
					on:click={() => state.adminOverrides.cooldown = !state.adminOverrides.cooldown}
				>Ignore Cooldown</button>
			{/if}
			{#if canIgnoreMask}
				<button
					class="button tool"
					class:active={state.adminOverrides.mask}
					on:click={() => state.adminOverrides.mask = !state.adminOverrides.mask}
				>Place Anywhere</button>
			{/if}
		</div>
	{/if}
</div>
