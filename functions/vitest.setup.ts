import { deleteApp, getApp, initializeApp } from "firebase-admin/app";
import { afterAll, beforeAll } from "vitest";

beforeAll(() => {
	try {
		getApp();
	} catch {
		initializeApp({ projectId: process.env.GCLOUD_PROJECT });
	}
});

afterAll(async () => {
	try {
		await deleteApp(getApp());
	} catch {
		// already deleted
	}
});
