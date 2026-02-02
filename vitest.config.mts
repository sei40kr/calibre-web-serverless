import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["domain", "infrastructure", "web"],
	},
});
