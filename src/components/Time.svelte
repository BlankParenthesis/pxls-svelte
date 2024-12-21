<script lang="ts" context="module">
	import { writable, type Readable } from "svelte/store";

	let internalNow = writable(Date.now());
	setInterval(() => internalNow.set(Date.now()), 1000);
	export const now = { subscribe: internalNow.subscribe } as Readable<number>;
	export enum Mode {
		Absolute,
		Relative,
	};
	
	export const TIME_INTERVALS_NAMES = [
		["day", "days"],
		["hour", "hours"],
		["minute", "minutes"],
		["second", "seconds"],
	];
	export const TIME_INTERVALS_NAMES_SHORT = [
		["day", "days"],
		["hour", "hours"],
		["min", "mins"],
		["sec", "secs"],
	];
	export const TIME_INTERVALS_NAMES_RELATIVE = [
		["day ago", "days ago"],
		["hour ago", "hours ago"],
		["minute ago", "minutes ago"],
		["second ago", "seconds ago"],
	];
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

	export function durationString(duration: number, names = TIME_INTERVALS_NAMES): string {
		const intervals = durationToTimeIntervals(duration)
			.map((duration, i) => ({duration, names: names[i]}))
			.filter(({ duration }) => duration > 0)
			.map(({ duration, names }) => `${duration} ${names[Math.min(duration - 1, names.length - 1)]}`);

		return intervals[0] || "instant";
	}

	export function durationStringRelative(duration: number, names = TIME_INTERVALS_NAMES_RELATIVE): string {
		const intervals = durationToTimeIntervals(duration)
			.map((duration, i) => ({duration, names: names[i]}))
			.filter(({ duration }) => duration > 0)
			.map(({ duration, names }) => `${duration} ${names[Math.min(duration - 1, names.length - 1)]}`);

		return intervals[0] || "now";
	}
</script>
<script lang="ts">
	export let time: Date;
	export let mode: Mode = Mode.Absolute;
</script>
<style>
</style>
<time datetime={time.toISOString()}>
	{#if mode === Mode.Absolute}
		{time.toLocaleDateString()}
	{:else if mode === Mode.Relative}
		{durationString(Math.ceil((time.valueOf() - $now) / 1000))}
	{/if}
</time>
