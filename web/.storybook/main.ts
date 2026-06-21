import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	staticDirs: [{ from: "../../fixtures", to: "/" }],
	addons: [
		"@storybook/addon-vitest",
		"@storybook/addon-a11y",
		"@storybook/addon-docs",
	],
	framework: "@storybook/nextjs-vite",
};
export default config;
