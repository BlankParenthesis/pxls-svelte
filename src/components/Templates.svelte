<script lang="ts">
	import { type Writable } from "svelte/store";
	import { Template } from "../lib/render/template";
	import TemplateForm from "./Template.svelte";

	export let templates: Writable<Template[]>;

	function addTemplate() {
		templates.update(ts => [...ts, new Template()]);
	}

	// TODO: option to undo deleted template
	function deleteTemplate(template: Template) {
		templates.update((templates) => {
			const index = templates.indexOf(template);
			if (index !== -1) {
				const before = templates.slice(0, index);
				const after = templates.slice(index + 1);
				return [...before, ...after];
			} else {
				return templates;
			}
		});
	}
</script>
<style>
</style>
<h2>Templates</h2>
<section class="flex vertical align-middle gap">
	<ul class="item-list fullwidth">
		{#each $templates as template}
			<li><TemplateForm bind:template ondelete={() => deleteTemplate(template)}/></li>
		{/each}
	</ul>
	<button class="button suggested large" on:click={addTemplate}>New Template</button>
</section>
