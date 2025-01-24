<script lang="ts">
	import { Template } from "../lib/render/template";
	import TemplateForm from "./Template.svelte";

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
</style>
<h2>Templates</h2>
<section class="flex vertical align-middle gap">
	<ul class="item-list fullwidth">
		{#each templates as template}
			<li><TemplateForm bind:template ondelete={() => deleteTemplate(template)}/></li>
		{/each}
	</ul>
	<button class="button suggested large" on:click={addTemplate}>New Template</button>
</section>
