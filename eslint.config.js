import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
// TODO: look into sylistic and also add rules for consistent typscript delimiters

let rules = {
	"brace-style": "error",
	"camelcase": "error",
	"curly": "error",
	"eqeqeq": "error",
	"indent": ["error", "tab", { "SwitchCase": 1 }],
	"quotes": ["error", "double"],
	"comma-dangle": ["error", "always-multiline"],
	"semi": "error",
	"no-unused-vars": "off",
	"@typescript-eslint/require-await": "off",
	"@typescript-eslint/no-unused-expressions": "warn",
	"@typescript-eslint/no-unused-vars": ["warn", {
		"varsIgnorePattern": "^_",
		"caughtErrorsIgnorePattern": "^_",
		"destructuredArrayIgnorePattern": "^_",
	}],
	"svelte/valid-compile": "warn",
};

export default [
	{ languageOptions: { globals: globals.browser } },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs["flat/recommended"],
	{ rules },
	{
		files: ["**/*.svelte"],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: [".svelte"],
				svelteFeatures: { experimentalGenerics: true },
			},
		},
	},
];
