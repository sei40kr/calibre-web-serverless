import * as fs from "node:fs";
import * as path from "node:path";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";
import { resizeBookCover } from "./usecase";

const PROJECT_ID = process.env.GCLOUD_PROJECT!;
const BUCKET_NAME = `${PROJECT_ID}.appspot.com`;
const TEST_USER_ID = "test-user-id";

const coverFixture = path.resolve(
	import.meta.dirname,
	"..",
	"..",
	"..",
	"fixtures",
	"books",
	"alice-in-wonderland",
	"cover.jpg",
);

async function createStubBook(bookId: string): Promise<void> {
	const db = getFirestore();
	await db.doc(`users/${TEST_USER_ID}/books/${bookId}`).set({
		title: "Stub",
		hasCover: true,
		hasCustomCover: false,
		status: "ready",
		errorMessage: null,
		createdAt: FieldValue.serverTimestamp(),
		updatedAt: FieldValue.serverTimestamp(),
	});
}

async function uploadRaw(storagePath: string, data: Buffer): Promise<void> {
	await getStorage().bucket(BUCKET_NAME).file(storagePath).save(data);
}

async function exists(storagePath: string): Promise<boolean> {
	const [ok] = await getStorage()
		.bucket(BUCKET_NAME)
		.file(storagePath)
		.exists();
	return ok;
}

describe("resizeBookCover", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	it("resizes the upload, applies it, and clears the staging object", async () => {
		const bookId = "book-custom";
		const uploadPath = `users/${TEST_USER_ID}/books/${bookId}/cover_upload.jpg`;
		await createStubBook(bookId);
		await uploadRaw(uploadPath, fs.readFileSync(coverFixture));

		await resizeBookCover({
			bucketName: BUCKET_NAME,
			userId: TEST_USER_ID,
			bookId,
			storagePath: uploadPath,
		});

		expect(
			await exists(`users/${TEST_USER_ID}/books/${bookId}/custom_cover.png`),
		).toBe(true);
		expect(await exists(uploadPath)).toBe(false);

		const snap = await getFirestore()
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		expect(snap.data()?.hasCustomCover).toBe(true);
	});

	it("drops an oversized upload without applying it", async () => {
		const bookId = "book-oversized";
		const uploadPath = `users/${TEST_USER_ID}/books/${bookId}/cover_upload.jpg`;
		await createStubBook(bookId);
		await uploadRaw(uploadPath, fs.readFileSync(coverFixture));

		await resizeBookCover({
			bucketName: BUCKET_NAME,
			userId: TEST_USER_ID,
			bookId,
			storagePath: uploadPath,
			size: 50 * 1024 * 1024,
		});

		expect(
			await exists(`users/${TEST_USER_ID}/books/${bookId}/custom_cover.png`),
		).toBe(false);
		expect(await exists(uploadPath)).toBe(false);

		const snap = await getFirestore()
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		expect(snap.data()?.hasCustomCover).toBe(false);
	});

	it("drops an undecodable upload without applying it", async () => {
		const bookId = "book-garbage";
		const uploadPath = `users/${TEST_USER_ID}/books/${bookId}/cover_upload.jpg`;
		await createStubBook(bookId);
		await uploadRaw(uploadPath, Buffer.from("not an image"));

		await resizeBookCover({
			bucketName: BUCKET_NAME,
			userId: TEST_USER_ID,
			bookId,
			storagePath: uploadPath,
		});

		expect(
			await exists(`users/${TEST_USER_ID}/books/${bookId}/custom_cover.png`),
		).toBe(false);
		expect(await exists(uploadPath)).toBe(false);

		const snap = await getFirestore()
			.doc(`users/${TEST_USER_ID}/books/${bookId}`)
			.get();
		expect(snap.data()?.hasCustomCover).toBe(false);
	});
});
