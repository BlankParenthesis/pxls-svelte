<script lang="ts">
    import type { AppState } from "../lib/settings";

	export let state: AppState;
</script>
<style>
	.toolbar {
		display: flex;
		justify-content: space-between;
	}

	.admin-tools {
		text-align: left;
	}

	.user-tools {
		text-align: right;
	}

	button.enabled {
		background-color: #789abc;
		color: white;
	}
</style>
<div class="toolbar cursor-transparent">
	<div class="admin-tools">
		<button
			class:enabled={state.adminOverrides.color}
			on:click={() => state.adminOverrides.color = !state.adminOverrides.color}
		>Enable Admin Colors</button>
		<button
			class:enabled={state.adminOverrides.cooldown}
			on:click={() => state.adminOverrides.cooldown = !state.adminOverrides.cooldown}
		>Ignore Cooldown</button>
		<button
			class:enabled={state.adminOverrides.mask}
			on:click={() => state.adminOverrides.mask = !state.adminOverrides.mask}
		>Place Anywhere</button>
	</div>
	<div class="user-tools">
		<button>Inspect Pixel</button>
		<button>Activity Overlay</button>
	</div>
</div>
