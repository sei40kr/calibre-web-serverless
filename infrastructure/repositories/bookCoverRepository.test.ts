import { resolveObjectURL } from "node:buffer";
import * as fs from "node:fs";
import * as path from "node:path";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, storage } from "../lib/firebase";
import { clearFirestore } from "../testing/clearFirestore";
import { putServerObject } from "../testing/putServerObject";
import { signInTestUser } from "../testing/testUser";
import { bookCoverRepository } from "./bookCoverRepository";

const coverPath = path.resolve(
	import.meta.dirname,
	"../../fixtures/books/alice-in-wonderland/cover.jpg",
);

function loadCover(type = "image/jpeg", name = "cover.jpg"): File {
	const buffer = fs.readFileSync(coverPath);
	return new File([buffer], name, { type });
}

async function putObject(
	storagePath: string,
	body: Uint8Array = fs.readFileSync(coverPath),
): Promise<void> {
	await putServerObject(storagePath, body, "image/png");
}

/** The bytes behind an object URL the repository returned. */
async function objectUrlText(url: string): Promise<string> {
	const blob = resolveObjectURL(url);
	if (!blob) throw new Error(`Not an object URL: ${url}`);
	return blob.text();
}

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

describe("bookCoverRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("uploadCustomCover", () => {
		it("stores the raw upload at the cover_upload staging path", async () => {
			await bookCoverRepository.uploadCustomCover({
				userId,
				bookId: "upload-1",
				file: loadCover(),
			});

			const url = await getDownloadURL(
				ref(storage, `users/${userId}/books/upload-1/cover_upload.jpg`),
			);
			expect(url.length).toBeGreaterThan(0);
		});

		it("rejects unsupported image types", async () => {
			await expect(
				bookCoverRepository.uploadCustomCover({
					userId,
					bookId: "upload-2",
					file: loadCover("image/gif", "cover.gif"),
				}),
			).rejects.toThrow(/Unsupported image type/);
		});
	});

	describe("getCoverUrl", () => {
		it("resolves the metadata-extracted cover when no custom cover is set", async () => {
			await putObject(`users/${userId}/books/book-1/cover.png`);

			const url = await bookCoverRepository.getCoverUrl(userId, "book-1", {
				hasCover: true,
				hasCustomCover: false,
			});
			expect(url.length).toBeGreaterThan(0);
		});

		it("prefers the custom cover when one is active", async () => {
			const encode = (text: string) => new TextEncoder().encode(text);
			await putObject(
				`users/${userId}/books/book-2/cover.png`,
				encode("plain"),
			);
			await putObject(
				`users/${userId}/books/book-2/custom_cover.png`,
				encode("custom"),
			);

			const url = await bookCoverRepository.getCoverUrl(userId, "book-2", {
				hasCover: true,
				hasCustomCover: true,
			});
			// An object URL carries no path, so identify the cover by its bytes.
			expect(await objectUrlText(url)).toBe("custom");
		});

		it("rejects when the book has no cover", async () => {
			await expect(
				bookCoverRepository.getCoverUrl(userId, "book-3", {
					hasCover: false,
					hasCustomCover: false,
				}),
			).rejects.toThrow(/no cover/);
		});
	});

	describe("resetCustomCover", () => {
		it("removes the custom cover and clears the flag", async () => {
			const bookRef = doc(db, "users", userId, "books", "book-4");
			await setDoc(bookRef, { hasCustomCover: true });
			await putObject(`users/${userId}/books/book-4/custom_cover.png`);

			await bookCoverRepository.resetCustomCover({
				userId,
				bookId: "book-4",
			});

			const snapshot = await getDoc(bookRef);
			expect(snapshot.data()?.hasCustomCover).toBe(false);
			await expect(
				getDownloadURL(
					ref(storage, `users/${userId}/books/book-4/custom_cover.png`),
				),
			).rejects.toThrow();
		});

		it("is idempotent when no custom cover exists", async () => {
			const bookRef = doc(db, "users", userId, "books", "book-5");
			await setDoc(bookRef, { hasCustomCover: false });

			await expect(
				bookCoverRepository.resetCustomCover({
					userId,
					bookId: "book-5",
				}),
			).resolves.toBeUndefined();
		});
	});
});
