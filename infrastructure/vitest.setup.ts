import { deleteApp } from "firebase/app";
import { afterAll } from "vitest";
import { app } from "./lib/firebase";

afterAll(async () => {
	await deleteApp(app);
});
