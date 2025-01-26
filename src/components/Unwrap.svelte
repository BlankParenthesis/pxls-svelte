<script lang="ts" generics="T">
	import { type Readable } from "svelte/store";

	export let store: Readable<T>;
</script>
<slot value={$store} />
