<script lang="ts">
	export let state: boolean;
</script>
<style>
	button.active {
		background-color: #789abc;
		color: white;
	}
</style>
<button class:active={state} on:click={() => state = !state}>
	<slot/>
</button>