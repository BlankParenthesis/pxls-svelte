<script lang="ts">
	import { Template } from "../lib/render/template";

	export let template: Template;
	export let ondelete: () => void;
</script>
<style>
	.template {
		display: flex;
	}

	.template-thumbnail {
		display: flex;
		align-items: center;
		justify-content: center;
		border: var(--text-input-border);
		background: var(--text-input-background);
		border-radius: 0.5em;
		width: 5em;
		height: 5em;
		object-fit: contain;
	}

	input[type="number"] {
		width: 3em;
	}
</style>
<form class="template flex wrap gap center-all" on:submit={e => e.preventDefault()}>
	<div class="flex vertical gap">
		<img class="template-thumbnail" src={template.url} alt="template preview">
		<label class="grow checkbox button">
			Show
			<input type="checkbox" bind:checked={template.show}/>
		</label>
		<button type="button" class="grow button destructive" on:click={() => ondelete()}>Delete</button>
	</div>
	<div class="grow flex vertical gap space">
		<div class="flex gap">
			<label class="grow text">
				<input placeholder="Template Name" class="fullwidth" type="text" bind:value={template.title} />
			</label>
		</div>
		<!-- TODO: proper controls rather than just numerical inputs -->
		<div class="grow flex gap">
			<label class="grow number">
				<span>X:</span>
				<input type="number" bind:value={template.x} />
			</label>
			<label class="grow number">
				<span>Y:</span>
				<input type="number" bind:value={template.y} />
			</label>
			<label class="grow number">
				<span>Width:</span>
				<!-- FIXME: this does not correctly update when the template loads-->
				<input type="number" bind:value={template.width} />
			</label>
		</div>
		<label class="text fullwidth">
			<input placeholder="https://…" class="fullwidth" type="text" bind:value={template.url} />
		</label>
	</div>
</form>
