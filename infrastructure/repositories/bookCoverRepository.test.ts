import * as fs from "node:fs";
import * as path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { bookCoverRepository } from "./bookCoverRepository";

const coverPath = path.resolve(
	import.meta.dirname,
	"../../fixtures/books/alice-in-wonderland/cover.jpg",
);

function loadCover(): File {
	const buffer = fs.readFileSync(coverPath);
	return new File([buffer], "cover.jpg", { type: "image/jpeg" });
}

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

describe("bookCoverRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("uploadCover", () => {
		it("uploads a cover that can be retrieved via getCoverUrl", async () => {
			const file = loadCover();

			await bookCoverRepository.uploadCover({
				userId,
				bookId: "test-book-1",
				file,
			});

			const url = await bookCoverRepository.getCoverUrl(
				userId,
				"test-book-1",
				"jpg",
			);
			expect(url).toEqual(expect.any(String));
			expect(url.length).toBeGreaterThan(0);
		});
	});

	describe("getCoverUrl", () => {
		it("returns a download URL for an uploaded cover", async () => {
			const file = loadCover();

			await bookCoverRepository.uploadCover({
				userId,
				bookId: "test-book-1",
				file,
			});

			const url = await bookCoverRepository.getCoverUrl(
				userId,
				"test-book-1",
				"jpg",
			);
			expect(url).toEqual(expect.any(String));
			expect(url.length).toBeGreaterThan(0);
		});

		it("returns different URLs for different formats", async () => {
			const jpgFile = loadCover();
			const buffer = fs.readFileSync(coverPath);
			const pngFile = new File([buffer], "cover.png", { type: "image/png" });

			await bookCoverRepository.uploadCover({
				userId,
				bookId: "test-book-1",
				file: jpgFile,
			});
			await bookCoverRepository.uploadCover({
				userId,
				bookId: "test-book-1",
				file: pngFile,
			});

			const jpgUrl = await bookCoverRepository.getCoverUrl(
				userId,
				"test-book-1",
				"jpg",
			);
			const pngUrl = await bookCoverRepository.getCoverUrl(
				userId,
				"test-book-1",
				"png",
			);

			expect(jpgUrl).not.toBe(pngUrl);
		});
	});
});
