import { defineConfig } from "eslint/config";
import boundariesPlugin from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";
import * as tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import path from "path";
import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import decoratorPosition from "eslint-plugin-decorator-position";

export default defineConfig([
	{
		ignores: ["dist", "node_modules"]
	},

	// ...tseslint.configs.recommended,
	// js.configs.recommended,

	{
		files: ["**/*.ts"],

		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: "latest",
				project: "./tsconfig.json",
				sourceType: "module",
			},
			globals: {
				...globals.node,
			},
		},

		plugins: {
			"@typescript-eslint": tsPlugin,
			import: importPlugin,
			boundaries: boundariesPlugin,
			decoratorPosition,
		},

		extends: ["plugin:decorator-position/recommended"],

		settings: {
			"import/resolver": {
				typescript: {
					project: path.resolve("./tsconfig.json")
				}
			},
			"boundaries/elements": [
				{ type: "services", pattern: "src/services/**", alias: "@services"},
				{ type: "common", pattern: "src/common/**", alias: "@common"},
				{ type: "app", pattern: "src/app/**", alias: "@app"},
			],
		},

		rules: {
			...js.configs.recommended.rules,
			...tseslint.configs.recommended.rules,

			"@typescript-eslint/no-explicit-any": "warn",
			"import/no-unresolved": "error",

			"boundaries/element-types": [2, {
				default: "disallow",
				rules: [
					{
						from: "services",
						allow: ["common"],
					},
					{
						from: "common",
						allow: ["common"],
					},
					{
						from: "app",
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

	{
		files: ['**/*.spec.ts', '**/__tests__/**/*.ts'],
		plugins: {
			jest
		},
		rules: {
			...jest.configs.recommended.rules
		},
		languageOptions: {
			globals: {
				...jest.environments.globals.globals
			}
		}
	},
]);