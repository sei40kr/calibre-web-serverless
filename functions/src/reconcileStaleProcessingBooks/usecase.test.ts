import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";
import { reconcileStaleProcessingBooks } from "./usecase";

const PROJECT_ID = process.env.GCLOUD_PROJECT!;
const BUCKET_NAME = `${PROJECT_ID}.appspot.com`;
const USER_ID = "test-user";

const HOUR_MS = 60 * 60 * 1000;

async function createBook(
	bookId: string,
	{
		status,
		updatedAt,
		files,
	}: {
		status: string;
		updatedAt: Date;
		/** File entry statuses by format; defaults to one epub mirroring `status`. */
		files?: Record<string, string>;
	},
): Promise<void> {
	const fileStatuses = files ?? { epub: status };
	const fileEntries = Object.fromEntries(
		Object.entries(fileStatuses).map(([format, fileStatus]) => [
			format,
			{
				fileSize: 1,
				status: fileStatus,
				errorCode: null,
				addedAt: Timestamp.fromDate(updatedAt),
			},
		]),
	);
	await getFirestore()
		.doc(`users/${USER_ID}/books/${bookId}`)
		.set({
			title: "",
			status,
			errorCode: null,
			files: fileEntries,
			hasProcessingFile: Object.values(fileStatuses).some(
				(fileStatus) => fileStatus === "processing",
			),
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

// The Firestore emulator's collection-group index lags a fresh write briefly, so
// a reconcile invoked immediately after createBook can miss the doc. Wait until
// the reconcile's own query would see it, keeping assertions deterministic. A
// real deployment is strongly consistent and needs no such wait.
async function waitForStaleVisible(
	bookId: string,
	olderThan: Date,
): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const snap = await getFirestore()
			.collectionGroup("books")
			.where("status", "==", "processing")
			.where("updatedAt", "<", Timestamp.fromDate(olderThan))
			.get();
		if (snap.docs.some((d) => d.id === bookId)) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error(`stale book ${bookId} never became visible to the query`);
}

// Same emulator-lag guard for the stale-file query (hasProcessingFile flag).
async function waitForStaleFileVisible(
	bookId: string,
	olderThan: Date,
): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const snap = await getFirestore()
			.collectionGroup("books")
			.where("hasProcessingFile", "==", true)
			.where("updatedAt", "<", Timestamp.fromDate(olderThan))
			.get();
		if (snap.docs.some((d) => d.id === bookId)) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error(
		`stale file entry of ${bookId} never became visible to the query`,
	);
}

describe("reconcileStaleProcessingBooks", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	it("reprocesses a stale processing book whose file is present", async () => {
		// The upload landed but extraction never finished — recover it by
		// re-running extraction, not by discarding the intact file.
		const olderThan = new Date(Date.now() - HOUR_MS);
		await createBook("reprocess-me", {
			status: "processing",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});
		await uploadObject(`users/${USER_ID}/books/reprocess-me/book.epub`);
		await waitForStaleVisible("reprocess-me", olderThan);

		const reprocess = vi.fn(async () => {});
		const result = await reconcileStaleProcessingBooks({
			olderThan,
			dryRun: false,
			reprocess,
		});

		expect(result.found).toBe(1);
		expect(result.reprocessed).toBe(1);
		expect(result.deleted).toBe(0);
		expect(result.failed).toBe(0);
		expect(reprocess).toHaveBeenCalledWith({
			userId: USER_ID,
			bookId: "reprocess-me",
			format: "epub",
			originalName: undefined,
		});
		// The stub and its file are left in place for the reprocess to act on.
		expect(await docExists("reprocess-me")).toBe(true);
		expect(
			await objectExists(`users/${USER_ID}/books/reprocess-me/book.epub`),
		).toBe(true);
	});

	it("deletes a stale processing book whose file never landed", async () => {
		// No file: an interrupted upload left only the stub. Nothing to recover.
		const olderThan = new Date(Date.now() - HOUR_MS);
		await createBook("delete-me", {
			status: "processing",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});
		await waitForStaleVisible("delete-me", olderThan);

		const reprocess = vi.fn(async () => {});
		const result = await reconcileStaleProcessingBooks({
			olderThan,
			dryRun: false,
			reprocess,
		});

		expect(result.found).toBe(1);
		expect(result.deleted).toBe(1);
		expect(result.reprocessed).toBe(0);
		expect(reprocess).not.toHaveBeenCalled();
		expect(await docExists("delete-me")).toBe(false);
	});

	it("keeps processing books updated within the threshold", async () => {
		// Updated more recently than `olderThan`, so it is still in flight and
		// must not be treated as stale.
		await createBook("recent", {
			status: "processing",
			updatedAt: new Date(Date.now() - HOUR_MS / 2),
		});
		await uploadObject(`users/${USER_ID}/books/recent/book.epub`);

		const reprocess = vi.fn(async () => {});
		const result = await reconcileStaleProcessingBooks({
			olderThan: new Date(Date.now() - HOUR_MS),
			dryRun: false,
			reprocess,
		});

		expect(result.found).toBe(0);
		expect(result.reprocessed).toBe(0);
		expect(result.deleted).toBe(0);
		expect(reprocess).not.toHaveBeenCalled();
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

		const result = await reconcileStaleProcessingBooks({
			olderThan: new Date(Date.now() - HOUR_MS),
			dryRun: false,
			reprocess: vi.fn(async () => {}),
		});

		expect(result.found).toBe(0);
		expect(result.reprocessed).toBe(0);
		expect(result.deleted).toBe(0);
		expect(await docExists("ready")).toBe(true);
		expect(await docExists("errored")).toBe(true);
		expect(await objectExists(`users/${USER_ID}/books/ready/book.epub`)).toBe(
			true,
		);
	});

	it("marks a stale processing file entry ready when its object exists", async () => {
		const olderThan = new Date(Date.now() - HOUR_MS);
		await createBook("ready-with-file", {
			status: "ready",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
			files: { epub: "ready", pdf: "processing" },
		});
		await uploadObject(`users/${USER_ID}/books/ready-with-file/book.pdf`);
		await waitForStaleFileVisible("ready-with-file", olderThan);

		const reprocess = vi.fn(async () => {});
		const result = await reconcileStaleProcessingBooks({
			olderThan,
			dryRun: false,
			reprocess,
		});

		expect(result.foundFiles).toBe(1);
		expect(result.filesMarkedReady).toBe(1);
		expect(result.fileEntriesRemoved).toBe(0);
		expect(result.failed).toBe(0);
		expect(reprocess).not.toHaveBeenCalled();

		const snap = await getFirestore()
			.doc(`users/${USER_ID}/books/ready-with-file`)
			.get();
		expect(snap.data()?.files.pdf.status).toBe("ready");
		expect(snap.data()?.hasProcessingFile).toBe(false);
	});

	it("removes a stale processing file entry whose object never landed", async () => {
		const olderThan = new Date(Date.now() - HOUR_MS);
		await createBook("ready-without-file", {
			status: "ready",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
			files: { epub: "ready", pdf: "processing" },
		});
		await waitForStaleFileVisible("ready-without-file", olderThan);

		const result = await reconcileStaleProcessingBooks({
			olderThan,
			dryRun: false,
			reprocess: vi.fn(async () => {}),
		});

		expect(result.foundFiles).toBe(1);
		expect(result.filesMarkedReady).toBe(0);
		expect(result.fileEntriesRemoved).toBe(1);

		const snap = await getFirestore()
			.doc(`users/${USER_ID}/books/ready-without-file`)
			.get();
		expect(snap.data()?.files.pdf).toBeUndefined();
		expect(snap.data()?.files.epub.status).toBe("ready");
		expect(snap.data()?.hasProcessingFile).toBe(false);
	});

	it("dry run reports matches without acting", async () => {
		const olderThan = new Date(Date.now() - HOUR_MS);
		await createBook("dry-me", {
			status: "processing",
			updatedAt: new Date(Date.now() - 2 * HOUR_MS),
		});
		await uploadObject(`users/${USER_ID}/books/dry-me/book.epub`);
		await waitForStaleVisible("dry-me", olderThan);

		const reprocess = vi.fn(async () => {});
		const result = await reconcileStaleProcessingBooks({
			olderThan,
			dryRun: true,
			reprocess,
		});

		expect(result.dryRun).toBe(true);
		expect(result.found).toBe(1);
		expect(result.reprocessed).toBe(0);
		expect(result.deleted).toBe(0);
		expect(result.books).toEqual([{ userId: USER_ID, bookId: "dry-me" }]);
		expect(reprocess).not.toHaveBeenCalled();
		expect(await docExists("dry-me")).toBe(true);
	});
});
