<script lang="ts">
	import Debug from "./Debug.svelte";
    import { type Settings } from "../lib/settings";

	export let settings: Settings;
</script>
<style>
</style>
<h2>Settings Menu</h2>
<p>There would be some settings here</p>
<Debug bind:settings={settings.debug} />
