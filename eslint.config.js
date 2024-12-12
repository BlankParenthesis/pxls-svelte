import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";

let rules = {
	"brace-style": "error",
	"camelcase": "error",
	"curly": "error",
	"eqeqeq": "error",
	"indent": ["error", "tab", { "SwitchCase": 1 }],
	"quotes": ["error", "double"],
	"comma-dangle": ["error", "always-multiline"],
	"semi": "error",
	"@typescript-eslint/require-await": "off",
	"@typescript-eslint/no-unused-expressions": "warn",
	"@typescript-eslint/no-unused-vars": "warn",
};

export default [
	{ languageOptions: { globals: globals.browser } },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs.recommended,
	{ rules },
];
