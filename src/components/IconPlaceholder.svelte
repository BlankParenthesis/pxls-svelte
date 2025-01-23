<script lang="ts">
	export let label: string;
	export let randomness: string;

	function iconPlaceholder(name: string): string {
		let placeholder = name.split(/ +/g)
			.filter(s => s.length > 0)
			.map(s => s[0])
			.join("")
			.toUpperCase();

		if (placeholder.length > 4) {
			return placeholder.substring(0, 3) + "…";
		} else {
			return placeholder;
		}
	}

	// https://developer.gnome.org/hig/reference/palette.html
	const COLORS = [
		"#3584e4",
		"#33d17a",
		"#f6d32d",
		"#ff7800",
		"#e01b24",
		"#9141ac",
		"#986a44",
	];

	function colorPlaceholder(randomness: string): string {
		// sum the codepoints; this is random enough
		const random = randomness.split("")
			.map(c => c.codePointAt(0) as number)
			.reduce((a, b) => a + b, 0);
		return COLORS[random % COLORS.length];
	}
</script>
<style>
	.placeholder-icon {
		width: 3em;
		height: 3em;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #fff;
		font-weight: bold;
	}
</style>
<div class="no-shrink placeholder-icon" style:background="{colorPlaceholder(randomness)}">
	{iconPlaceholder(label)}
</div>
