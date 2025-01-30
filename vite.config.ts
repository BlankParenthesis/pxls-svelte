import { defineConfig, PluginOption } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
	const inProduction = command !== "serve";

	const plugins = svelte() as Array<PluginOption>;

	if (inProduction) {
		plugins.push(viteSingleFile());
	}

	return {
		plugins,
		build: {
			minify: true,
			sourcemap: !inProduction,
		},
	};
});
