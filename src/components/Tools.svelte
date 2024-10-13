<script lang="ts">
    import type { Readable } from "svelte/store";
    import type { Board } from "../lib/board/board";
    import type { Pixel } from "../lib/pixel";
    import type { AppState, Settings } from "../lib/settings";
    import Time from "./Time.svelte";
    import LookupUser from "./LookupUser.svelte";
    import { onDestroy } from "svelte";

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

	const TIME_INTERVALS_NAMES = [
		["day", "days"],
		["hour", "hours"],
		["minute", "minutes"],
		["second", "seconds"],
	]
	const TIME_INTERVALS_NAMES_RELATIVE = [
		["day ago", "days ago"],
		["hour ago", "hours ago"],
		["minute ago", "minutes ago"],
		["second ago", "seconds ago"],
	]
	const TIME_INTERVALS = [
		60 * 60 * 24,
		60 * 60,
		60,
		1,
	];
	function durationToTimeIntervals(duration: number) {
		const intervals = [0, 0, 0, 0] as [number, number, number, number];

		for (let i = 0; i < TIME_INTERVALS.length; i++) {
			intervals[i] = Math.floor(duration / TIME_INTERVALS[i]);
			duration -= intervals[i] * TIME_INTERVALS[i];
		}

		return intervals;
	}

	function printDuration(duration: number): string {
		const intervals = durationToTimeIntervals(duration)
			.map((duration, i) => ({duration, names: TIME_INTERVALS_NAMES[i]}))
			.filter(({ duration }) => duration > 0)
			.map(({ duration, names }) => `${duration} ${names[Math.min(duration - 1, names.length - 1)]}`);

		return intervals[0] || "instant";
	}

	function printDurationRelative(duration: number): string {
		const intervals = durationToTimeIntervals(duration)
			.map((duration, i) => ({duration, names: TIME_INTERVALS_NAMES_RELATIVE[i]}))
			.filter(({ duration }) => duration > 0)
			.map(({ duration, names }) => `${duration} ${names[Math.min(duration - 1, names.length - 1)]}`);

		return intervals[0] || "now";
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

	function setLookupPointer() {
		if (state.pointer?.type === "lookup") {
			state.pointer = undefined;
		} else {
			state.pointer = {
				type: "lookup",
				background: "transparent",
				async activate(x: number, y: number) {
					const shape =$info.shape;
					const position = shape.indexArrayToPosition(shape.coordinatesToIndexArray(x, y))
					lookup = board.pixel(position);
					await lookup;
				},
			}
		}
	}

	let duration = durationToValue(settings.heatmap.duration);
	$: settings.heatmap.duration = valueToDuration(duration);
	let offset = durationToValue(-settings.heatmap.position);
	$: settings.heatmap.position = -valueToDuration(offset);

	let lookup: Readable<Promise<Pixel | undefined> | undefined> | undefined;
	let info = board.info;

	onDestroy(() => {
		if (state.pointer?.type === "lookup") {
			state.pointer = undefined;
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

	.flipped {
		direction: rtl;
	}

	.tool {
		background: var(--tool-button-background);
		border: 1px solid #222;
		width: 4em;
		height: 4em;
	}

	.tool.active {
		color: var(--tool-button-active-foreground);
		background: var(--tool-button-active-background);
	}
</style>
<div class="flex reverse space cursor-transparent">
	<div class="user-tools flex bottom">
		<div class="flex vertical group">
			{#if lookup}
				{#if $lookup}
					<div class="lookup">
						{#await $lookup }
							Loading Pixel…
						{:then pixel }
							{#if typeof pixel === "undefined"}
								Never placed
							{:else}
								<div>{$info.shape.indexArrayToCoordinates($info.shape.positionToIndexArray(pixel.position))}</div>
								<Time time={pixel.modified} />

								{#if typeof pixel.user !== "undefined"}
									<LookupUser {access} user={pixel.user} />
								{/if}
							{/if}
						{/await}
					</div>
				{:else}
					<div class="lookup">
						Outdated
					</div>
				{/if}
			{/if}
			{#if canLookup}
				<button class="round tool" class:active={state.pointer?.type === "lookup"} on:click={setLookupPointer}>
					<div class="icon large">🔍</div>
					<small>Inspect</small>
				</button>
			{/if}
		</div>
		<div class="flex vertical group">
			{#if settings.heatmap.enabled}
				<label>
					<span class="inline-label">Offset: {printDurationRelative(-settings.heatmap.position - 1)}</span>
					<input
						type="range"
						class="flipped"
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
				</label>
				<label>
					<span class="inline-label">Duration: {printDuration(settings.heatmap.duration)}</span>
					<input
						type="range"
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
			<button
				class="round tool"
				class:active={settings.heatmap.enabled}
				on:click={() => settings.heatmap.enabled = !settings.heatmap.enabled}
			>
				<div class="icon large">👁️</div>
				<small>Heatmap</small>
			</button>
		</div>
	</div>
	{#if hasAdminTool}
		<div class="admin-tools flex wrap-reverse bottom">
			{#if canUseStaffColors}
				<button
					class="round tool"
					class:active={state.adminOverrides.color}
					on:click={() => state.adminOverrides.color = !state.adminOverrides.color}
				>Enable Admin Colors</button>
			{/if}
			{#if canIgnoreCooldown}
				<button
					class="round tool"
					class:active={state.adminOverrides.cooldown}
					on:click={() => state.adminOverrides.cooldown = !state.adminOverrides.cooldown}
				>Ignore Cooldown</button>
			{/if}
			{#if canIgnoreMask}
				<button
					class="round tool"
					class:active={state.adminOverrides.mask}
					on:click={() => state.adminOverrides.mask = !state.adminOverrides.mask}
				>Place Anywhere</button>
			{/if}
		</div>
	{/if}
</div>
