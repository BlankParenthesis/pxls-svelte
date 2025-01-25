<script lang="ts">
	import { type Writable } from "svelte/store";
	import { Template } from "../lib/render/template";
	import TemplateForm from "./Template.svelte";
	import { Board } from "../lib/board/board";
	import none from "../assets/template_style_none.webp";
	import dotted11 from "../assets/template_style_dotted_1_1.webp";
	import dotted22 from "../assets/template_style_dotted_2_2.webp";
	import nonePreview from "../assets/template_style_none_preview.webp";
	import dotted11Preview from "../assets/template_style_dotted_1_1_preview.webp";
	import dotted22Preview from "../assets/template_style_dotted_2_2_preview.webp";
	import customPreview from "../assets/template_style_custom_preview.webp";

	export let templates: Writable<Template[]>;
	export let selectedStyle: string;
	export let board: Board;

	function addTemplate() {
		templates.update(ts => [...ts, new Template(board.uri)]);
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

	let customSource = "";

	const TEMPLATE_STYLES = [
		{ name: "None", source: none, preview: nonePreview },
		{ name: "Small Squares", source: dotted11, preview: dotted11Preview, default: true },
		{ name: "Large Squares", source: dotted22, preview: dotted22Preview },
		{ name: "Custom", source: customSource, preview: customPreview },
	];
</script>
<style>
	.preview {
		border: var(--text-input-border);
		width: 10em;
		height: 8em;
		object-fit: cover;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		border-radius: 0.5em;
		color: #000;
		background: #ddd;
	}
</style>
<h2>Templates</h2>
<h3>Style</h3>
<section class="flex vertical gap">
	<form on:submit={e => e.preventDefault()} class="flex wrap gap distribute">
		{#each TEMPLATE_STYLES as style}
			<label class="radio button flex vertical center-all" class:selected={style.source === selectedStyle}>
				<img class="preview" src={style.preview} alt="Template style: {style.name}" />
				<p class="compact">{style.name}</p>
				<input
					type="radio"
					class="invisible"
					name={style.name}
					value={style.source}
					bind:group={selectedStyle}
				/>
			</label>
		{/each}
	</form>
	<label class="text">
		<span>Custom Style Source:</span>
		<input type="text" placeholder="https://…" />
	</label>
</section>
<h3>Designs</h3>
<section class="flex vertical align-middle gap">
	<ul class="item-list fullwidth">
		{#each $templates as template}
			<li><TemplateForm bind:template ondelete={() => deleteTemplate(template)}/></li>
		{/each}
	</ul>
	<button class="button suggested large" on:click={addTemplate}>New Template</button>
</section>
