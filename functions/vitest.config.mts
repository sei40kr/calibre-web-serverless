import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		globalSetup: ["./vitest.globalSetup.ts"],
		setupFiles: ["./vitest.setup.ts"],
		env: {
			FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
			STORAGE_EMULATOR_HOST: "http://127.0.0.1:9199",
			GCLOUD_PROJECT: "demo-test",
		},
		fileParallelism: false,
	},
});
