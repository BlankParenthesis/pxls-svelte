<script lang="ts" context="module">
	import { writable, type Readable } from "svelte/store";

	let internalNow = writable(Date.now());
	setInterval(() => internalNow.set(Date.now()), 1000);
	export const now = { subscribe: internalNow.subscribe } as Readable<number>;
	export enum Mode {
		Date,
		Duration,
		DurationShort,
		Relative,
	};

	const TIME_INTERVALS_NAMES = [
		["{} day", "{} days"],
		["{} hour", "{} hours"],
		["{} minute", "{} minutes"],
		["{} second", "{} seconds"],
	];
	const TIME_INTERVALS_NAMES_SHORT = [
		["{} day", "{} days"],
		["{} hour", "{} hours"],
		["{} min", "{} mins"],
		["{} sec", "{} secs"],
	];
	const TIME_INTERVALS_NAMES_PAST = [
		["{} day ago", "{} days ago"],
		["{} hour ago", "{} hours ago"],
		["{} minute ago", "{} minutes ago"],
		["{} second ago", "{} seconds ago"],
	];
	const TIME_INTERVALS_NAMES_FUTURE = [
		["in {} day", "in {} days"],
		["in {} hour", "in {} hours"],
		["in {} minute", "in {} minutes"],
		["in {} second", "in {} seconds"],
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

	function durationStringsNamed(duration: number, names: Array<Array<string>>): Array<string> {
		return durationToTimeIntervals(duration)
			.map((duration, i) => ({ duration, names: names[i] }))
			.filter(({ duration }) => duration > 0)
			.map(({ duration, names }) => ({ duration, name: names[Math.min(duration - 1, names.length - 1)] }))
			.map(({ duration, name }) => name.replace("{}", duration.toString()));
	}

	export function durationString(duration: number) {
		return durationStringsNamed(duration, TIME_INTERVALS_NAMES)[0] || "instant";
	}

	export function durationStringShort(duration: number) {
		return durationStringsNamed(duration, TIME_INTERVALS_NAMES_SHORT)[0] || "0s";
	}

	function timedifferenceStringRelative(difference: number): string {
		const names = difference < 0 ? TIME_INTERVALS_NAMES_PAST : TIME_INTERVALS_NAMES_FUTURE;
		return durationStringsNamed(Math.abs(difference), names)[0] || "now";
	}
</script>
<script lang="ts">
	export let time: Date;
	export let mode: Mode = Mode.Date;
</script>
<style>
</style>
<time datetime={time.toISOString()}>
	{#if mode === Mode.Date}
		{time.toLocaleDateString()}
	{:else if mode === Mode.Duration}
		{durationString(Math.ceil((time.valueOf() - $now) / 1000))}
		{time.toLocaleDateString()}
	{:else if mode === Mode.DurationShort}
		{durationStringShort(Math.ceil((time.valueOf() - $now) / 1000))}
	{:else if mode === Mode.Relative}
		{timedifferenceStringRelative(Math.ceil((time.valueOf() - $now) / 1000))}
	{/if}
</time>
