<script lang="ts">
	import Grid from "./layout/Grid.svelte";
	import Debug from "./Debug.svelte";
    import { type Settings } from "../lib/settings";

	export let settings: Settings;
</script>

<Grid>
	<aside class="top-right">
		<Debug bind:settings={settings.debug} />
	</aside>
</Grid>	
