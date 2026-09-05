import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { bookFileRepository } from "./bookFileRepository";
import { bookRepository } from "./bookRepository";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

const createTestFile = (name: string, content = "dummy-content"): File => {
	return new File([content], name, { type: "application/octet-stream" });
};

// Extraction does not run against these emulators, so flip the book to ready
// manually where the file operations require it.
const createReadyBook = async (): Promise<string> => {
	const { bookId } = await bookRepository.createBook({
		userId,
		file: createTestFile("book.epub"),
	});
	const book = await bookRepository.getBook(userId, bookId);
	if (!book) throw new Error(`book ${bookId} not found`);
	await bookRepository.updateBook(userId, { ...book, status: "ready" });
	return bookId;
};

describe("bookFileRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("addBookFile", () => {
		it("adds a processing file entry for a new format", async () => {
			const bookId = await createReadyBook();

			const { format } = await bookFileRepository.addBookFile({
				userId,
				bookId,
				file: createTestFile("book.pdf"),
			});
			expect(format).toBe("pdf");

			const book = await bookRepository.getBook(userId, bookId);
			expect(book?.files.map((f) => f.format)).toEqual(["epub", "pdf"]);
			expect(book?.files.find((f) => f.format === "pdf")).toMatchObject({
				status: "processing",
			});
		});

		it("rejects a duplicate format", async () => {
			const bookId = await createReadyBook();

			await expect(
				bookFileRepository.addBookFile({
					userId,
					bookId,
					file: createTestFile("another.epub"),
				}),
			).rejects.toMatchObject({ code: "duplicate-format" });
		});

		it("rejects while the book is still processing", async () => {
			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			await expect(
				bookFileRepository.addBookFile({
					userId,
					bookId,
					file: createTestFile("book.pdf"),
				}),
			).rejects.toMatchObject({ code: "book-not-ready" });
		});

		it("rejects for a non-existent book", async () => {
			await expect(
				bookFileRepository.addBookFile({
					userId,
					bookId: "non-existent",
					file: createTestFile("book.pdf"),
				}),
			).rejects.toMatchObject({ code: "book-not-found" });
		});
	});

	describe("deleteBookFile", () => {
		it("removes the entry and keeps the remaining files", async () => {
			const bookId = await createReadyBook();
			await bookFileRepository.addBookFile({
				userId,
				bookId,
				file: createTestFile("book.pdf"),
			});

			await bookFileRepository.deleteBookFile(userId, bookId, "pdf");

			const book = await bookRepository.getBook(userId, bookId);
			expect(book?.files.map((f) => f.format)).toEqual(["epub"]);
		});

		it("refuses to remove the last remaining file", async () => {
			const bookId = await createReadyBook();

			await expect(
				bookFileRepository.deleteBookFile(userId, bookId, "epub"),
			).rejects.toMatchObject({ code: "last-file" });
		});
	});

	describe("getBookFileDownloadUrl", () => {
		it("returns a download URL for an uploaded file", async () => {
			const { bookId, format } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const url = await bookFileRepository.getBookFileDownloadUrl(
				userId,
				bookId,
				format,
			);
			expect(url).toEqual(expect.any(String));
			expect(url.length).toBeGreaterThan(0);
		});
	});
});
