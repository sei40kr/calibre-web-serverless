import { type ChildProcess, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import waitOn from "wait-on";

let emulatorProcess: ChildProcess | null = null;

const __dirname = dirname(fileURLToPath(import.meta.url));
const firebaseBin = resolve(__dirname, "node_modules/.bin/firebase");

const EMULATOR_RESOURCES = [
	"http-get://127.0.0.1:8080",
	"http-get://127.0.0.1:9099",
	"tcp:9199",
];

export const setup = async (): Promise<void> => {
	const alreadyRunning = await waitOn({
		resources: EMULATOR_RESOURCES,
		timeout: 1000,
	})
		.then(() => true)
		.catch(() => false);

	if (alreadyRunning) {
		return;
	}

	emulatorProcess = spawn(
		firebaseBin,
		[
			"emulators:start",
			"--only=auth,firestore,storage",
			`--project=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`,
		],
		{ stdio: "ignore" },
	);

	emulatorProcess.on("error", (err) => {
		throw new Error(`Failed to start Firebase emulators: ${err.message}`);
	});

	await waitOn({ resources: EMULATOR_RESOURCES, timeout: 30_000 });
};

export const teardown = async (): Promise<void> => {
	if (emulatorProcess) {
		emulatorProcess.kill();
		emulatorProcess = null;
	}
};
