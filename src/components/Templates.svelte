<script lang="ts">
    import { Template } from "../lib/render/template";

	export let templates: Template[];

	function addTemplate() {
		templates = [...templates, new Template()];
	}

	// TODO: option to undo deleted template
	function deleteTemplate(template: Template) {
		const index = templates.indexOf(template);
		if (index !== -1) {
			const before = templates.slice(0, index);
			const after = templates.slice(index + 1);
			templates = [...before, ...after];
		}
	}
</script>
<style>
	.template {
		display: flex;
	}

	.template > img {
		width: 4.75em;
		height: 4.75em;
		object-fit: contain;
	}

	input[type="number"] {
		width: 5em;
	}
</style>
<h2>Templates</h2>
<ul>
	{#each templates as template}
		<li class="template flex">
			<img src={template.url} alt="template preview">
			<div class="grow flex vertical">
				<div class="flex bottom">
					<label class="grow">
						<span class="inline-label">Title</span>
						<input placeholder="Unnamed Template" class="fullwidth" type="text" bind:value={template.title} />
					</label>
					<!-- TODO: proper controls rather than just numerical inputs -->
					<label>
						<span class="inline-label">X</span>
						<input type="number" bind:value={template.x} />
					</label>
					<label>
						<span class="inline-label">Y</span>
						<input type="number" bind:value={template.y} />
					</label>
					<label>
						<span class="inline-label">Width</span>
						<!-- FIXME: this does not correctly update when the template loads-->
						<input type="number" bind:value={template.width} />
					</label>
					<button class="button destructive" on:click={() => deleteTemplate(template)}>Delete</button>
				</div>
				<label class="grow">
					<span class="inline-label">Source URL</span>
					<input placeholder="https://…" class="fullwidth" type="text" bind:value={template.url} />
				</label>
			</div>
		</li>
	{/each}
</ul>
<button class="button" on:click={addTemplate}>New Template</button>
