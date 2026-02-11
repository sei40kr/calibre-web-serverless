import { execSync } from "node:child_process";
import { join } from "node:path";
import concurrently from "concurrently";
import { config } from "dotenv";

// Load .env.development so child processes (seed, etc.) inherit these vars
config({ path: join(import.meta.dirname, "..", ".env.development") });

// Build functions before starting emulators
const functionsDir = join(import.meta.dirname, "..", "..", "functions");
console.log("[dev] Building functions...");
execSync("bun run build", { cwd: functionsDir, stdio: "inherit" });

const { result } = concurrently(
	[
		"firebase emulators:start --project=demo-project --only auth,firestore,storage,functions,eventarc",
		"wait-on http-get://127.0.0.1:8080 http-get://127.0.0.1:9099 tcp:9299 tcp:9199 tcp:5001 && bun run scripts/seed.ts && next dev --webpack",
	],
	{
		killOthersOn: ["failure", "success"],
	},
);

result.catch(() => process.exit(1));
