import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const env = loadEnv("test", "web", "");
Object.assign(process.env, env);

export default defineConfig({
	test: {
		env,
		projects: ["domain", "infrastructure", "web"],
	},
});
