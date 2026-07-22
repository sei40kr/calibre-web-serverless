import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";
import { cleanupStaleProcessingBooks } from "./usecase";

const PROJECT_ID = process.env.GCLOUD_PROJECT!;
const BUCKET_NAME = `${PROJECT_ID}.appspot.com`;
const USER_ID = "test-user";

const HOUR_MS = 60 * 60 * 1000;

async function createBook(
	bookId: string,
	{ status, updatedAt }: { status: string; updatedAt: Date },
): Promise<void> {
	await getFirestore()
		.doc(`users/${USER_ID}/books/${bookId}`)
		.set({
			title: "",
			status,
			errorMessage: null,
			format: "epub",
			hasCover: false,
			hasCustomCover: false,
			createdAt: Timestamp.fromDate(updatedAt),
			updatedAt: Timestamp.fromDate(updatedAt),
		});
}

async function uploadObject(storagePath: string): Promise<void> {
	await getStorage()
		.bucket(BUCKET_NAME)
		.file(storagePath)
		.save(Buffer.from("x"));
}

async function docExists(bookId: string): Promise<boolean> {
	const snap = await getFirestore()
		.doc(`users/${USER_ID}/books/${bookId}`)
		.get();
	return snap.exists;
}

async function objectExists(storagePath: string): Promise<boolean> {
	const [ok] = await getStorage()
		.bucket(BUCKET_NAME)
		.file(storagePath)
		.exists();
	return ok;
}

describe("cleanupStaleProcessingBooks", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	it("deletes stale processing books and their storage objects", async () => {
		await createBook("stale", {
			status: "processing",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});
		await uploadObject(`users/${USER_ID}/books/stale/book.epub`);
		await uploadObject(`users/${USER_ID}/books/stale/cover.png`);

		const result = await cleanupStaleProcessingBooks({
			olderThan: new Date(Date.now() - HOUR_MS),
			dryRun: false,
		});

		expect(result.found).toBe(1);
		expect(result.deleted).toBe(1);
		expect(result.failed).toBe(0);
		expect(await docExists("stale")).toBe(false);
		expect(await objectExists(`users/${USER_ID}/books/stale/book.epub`)).toBe(
			false,
		);
		expect(await objectExists(`users/${USER_ID}/books/stale/cover.png`)).toBe(
			false,
		);
	});

	it("keeps processing books updated within the threshold", async () => {
		// Updated more recently than `olderThan`, so it is still in flight and
		// must not be treated as stale.
		await createBook("recent", {
			status: "processing",
			updatedAt: new Date(Date.now() - HOUR_MS / 2),
		});
		await uploadObject(`users/${USER_ID}/books/recent/book.epub`);

		const result = await cleanupStaleProcessingBooks({
			olderThan: new Date(Date.now() - HOUR_MS),
			dryRun: false,
		});

		expect(result.found).toBe(0);
		expect(result.deleted).toBe(0);
		expect(await docExists("recent")).toBe(true);
		expect(await objectExists(`users/${USER_ID}/books/recent/book.epub`)).toBe(
			true,
		);
	});

	it("keeps non-processing books even when old", async () => {
		// Both are older than `olderThan` but have already reached a terminal
		// status, so they are not stale stubs.
		await createBook("ready", {
			status: "ready",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});
		await createBook("errored", {
			status: "error",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});
		await uploadObject(`users/${USER_ID}/books/ready/book.epub`);

		const result = await cleanupStaleProcessingBooks({
			olderThan: new Date(Date.now() - HOUR_MS),
			dryRun: false,
		});

		expect(result.found).toBe(0);
		expect(result.deleted).toBe(0);
		expect(await docExists("ready")).toBe(true);
		expect(await docExists("errored")).toBe(true);
		expect(await objectExists(`users/${USER_ID}/books/ready/book.epub`)).toBe(
			true,
		);
	});

	it("dry run reports matches without deleting", async () => {
		await createBook("stale", {
			status: "processing",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});

		const result = await cleanupStaleProcessingBooks({
			olderThan: new Date(Date.now() - HOUR_MS),
			dryRun: true,
		});

		expect(result.dryRun).toBe(true);
		expect(result.found).toBe(1);
		expect(result.deleted).toBe(0);
		expect(result.books).toEqual([{ userId: USER_ID, bookId: "stale" }]);
		expect(await docExists("stale")).toBe(true);
	});
});
