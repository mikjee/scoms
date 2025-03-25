import { defineConfig } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
	{
		files: ["**/*.{ts}"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				...globals.node,
			},
		},
		plugins: {
			js,
			boundaries,
		},
		settings: {
			"boundaries/elements": [
				{ type: "services", pattern: "src/services/**" },
				{ type: "common", pattern: "src/common/**" },
				{ type: "monolith", pattern: "src/monolith/**" },
			],
		},
		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,
			...boundaries.configs.recommended.rules,
			"boundaries/element-types": [2, {
				default: "disallow",
				rules: [
					{
						from: "services/*",
						allow: ["common"],
					},
					{
						from: "common",
						allow: ["common"],
					},
					{
						from: "monolith",
						allow: ["common", "services"],
					},
				],
			}],
		},
	},
	{
		files: ["src/services/**/*.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "console",
					property: "log",
					message: "Use this.log instead of console.log in services"
				},
				{
					object: "console",
					property: "error",
					message: "Use this.error instead of console.error in services"
				}
			]
		}
	},
]);