import globals from "globals";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import stylistic from "@stylistic/eslint-plugin";

let rules = {
	"eqeqeq": "error",
	"camelcase": "error",
	"curly": "error",
	"no-unused-vars": "off",
	"svelte/valid-compile": "warn",
	"svelte/indent": ["error", { "indent": "tab" }],
	"@typescript-eslint/no-unused-expressions": "warn",
	"@typescript-eslint/no-unused-vars": ["warn", {
		"varsIgnorePattern": "^_",
		"caughtErrorsIgnorePattern": "^_",
		"destructuredArrayIgnorePattern": "^_",
	}],
	"@stylistic/quote-props": ["error", "consistent"],
	"@stylistic/brace-style": ["error", "1tbs"],
	"@stylistic/quotes": ["error", "double"],
	"@stylistic/indent": ["error", "tab", { "SwitchCase": 1 }],
	"@stylistic/comma-dangle": ["error", "always-multiline"],
	"@stylistic/semi": ["error", "always"],
	"@stylistic/no-tabs": "off",
	"@stylistic/member-delimiter-style": ["error", {
		"multiline": { "delimiter": "semi", "requireLast": true },
		"singleline": { "delimiter": "semi", "requireLast": false },
	}],
};

export default [
	{ languageOptions: { globals: globals.browser } },
	...tseslint.configs.recommended,
	...svelte.configs["flat/recommended"],
	stylistic.configs["recommended-flat"],
	{ rules },
	{
		files: ["**/*.svelte"],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: {
					ts: "@typescript-eslint/parser",
				},
			},
		},
	},
];
