import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["repositories/**/*.test.ts", "services/**/*.test.ts"],
		globalSetup: ["./vitest.globalSetup.ts"],
		setupFiles: ["./vitest.setup.ts"],
		env: {
			FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
		},
		fileParallelism: false,
	},
});
