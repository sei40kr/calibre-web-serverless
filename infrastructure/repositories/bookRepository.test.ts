import type { Book } from "@calibre-web-serverless/domain/models/book";
import { ISBN13 } from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import { doc, getDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/firebase";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { authorRepository } from "./authorRepository";
import { bookRepository } from "./bookRepository";
import { publisherRepository } from "./publisherRepository";
import { seriesRepository } from "./seriesRepository";
import { tagRepository } from "./tagRepository";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

const createTestFile = (name: string, content = "dummy-content"): File => {
	return new File([content], name, { type: "application/octet-stream" });
};

describe("bookRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("hasBooks", () => {
		it("returns false when no books exist", async () => {
			const result = await bookRepository.hasBooks(userId);
			expect(result).toBe(false);
		});

		it("returns true after uploading a book", async () => {
			await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const result = await bookRepository.hasBooks(userId);
			expect(result).toBe(true);
		});
	});

	describe("createBook", () => {
		it("returns bookId and format", async () => {
			const result = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			expect(result.bookId).toEqual(expect.any(String));
			expect(result.bookId.length).toBeGreaterThan(0);
			expect(result.format).toBe("epub");
		});

		it("extracts format from file extension", async () => {
			const result = await bookRepository.createBook({
				userId,
				file: createTestFile("book.pdf"),
			});

			expect(result.format).toBe("pdf");
		});

		it("creates a book that can be retrieved with getBook", async () => {
			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const book = await bookRepository.getBook(userId, bookId);
			expect(book).not.toBeNull();
			if (!book) return;

			expect(book.id).toBe(bookId);
			expect(book.userId).toBe(userId);
			expect(book.title).toBe("");
			expect(book.files).toHaveLength(1);
			expect(book.files[0]).toMatchObject({
				format: "epub",
				status: "processing",
			});
			expect(book.createdAt).toBeInstanceOf(Date);
			expect(book.updatedAt).toBeInstanceOf(Date);
		});

		it("rejects an unsupported file extension", async () => {
			await expect(
				bookRepository.createBook({
					userId,
					file: createTestFile("book.xyz"),
				}),
			).rejects.toMatchObject({ code: "unsupported-format" });
		});
	});

	describe("getBook", () => {
		it("returns null for a non-existent book", async () => {
			const book = await bookRepository.getBook(userId, "non-existent");
			expect(book).toBeNull();
		});
	});

	describe("updateBook", () => {
		it("updates book metadata", async () => {
			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const book = await bookRepository.getBook(userId, bookId);
			expect(book).not.toBeNull();
			if (!book) return;

			await bookRepository.updateBook(userId, {
				...book,
				title: "Updated Title",
				description: "A great book",
			});

			const result = await bookRepository.getBook(userId, bookId);
			expect(result).not.toBeNull();
			if (!result) return;

			expect(result.title).toBe("Updated Title");
			expect(result.description).toBe("A great book");
		});

		it("round-trips Language values", async () => {
			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const book = await bookRepository.getBook(userId, bookId);
			expect(book).not.toBeNull();
			if (!book) return;

			await bookRepository.updateBook(userId, {
				...book,
				languages: [Language.EN, Language.JA],
			});

			const result = await bookRepository.getBook(userId, bookId);
			expect(result).not.toBeNull();
			if (!result) return;

			expect(result.languages).toEqual([Language.EN, Language.JA]);
		});

		it("round-trips Identifier values", async () => {
			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const book = await bookRepository.getBook(userId, bookId);
			expect(book).not.toBeNull();
			if (!book) return;

			await bookRepository.updateBook(userId, {
				...book,
				identifiers: [{ type: ISBN13, value: "9784101010014" }],
			});

			const result = await bookRepository.getBook(userId, bookId);
			expect(result).not.toBeNull();
			if (!result) return;

			expect(result.identifiers).toHaveLength(1);
			expect(result.identifiers[0].type).toBe(ISBN13);
			expect(result.identifiers[0].value).toBe("9784101010014");
		});

		it("syncs bookCount when authorIds change", async () => {
			const author1 = await authorRepository.create(userId, "Author 1");
			const author2 = await authorRepository.create(userId, "Author 2");

			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			const book = await bookRepository.getBook(userId, bookId);
			expect(book).not.toBeNull();
			if (!book) return;

			// Assign author1
			await bookRepository.updateBook(userId, {
				...book,
				authorIds: [author1.id],
			});

			const author1Ref = doc(db, "users", userId, "authors", author1.id);
			const author1After = await getDoc(author1Ref);
			expect(author1After.data()?.bookCount).toBe(1);

			// Change to author2
			const bookAfterFirst = await bookRepository.getBook(userId, bookId);
			expect(bookAfterFirst).not.toBeNull();
			if (!bookAfterFirst) return;

			await bookRepository.updateBook(userId, {
				...bookAfterFirst,
				authorIds: [author2.id],
			});

			// author1 bookCount went to 0 → document gets deleted
			const author1Deleted = await getDoc(author1Ref);
			expect(author1Deleted.exists()).toBe(false);

			// author2 bookCount should be 1
			const author2Ref = doc(db, "users", userId, "authors", author2.id);
			const author2After = await getDoc(author2Ref);
			expect(author2After.data()?.bookCount).toBe(1);
		});
	});

	describe("deleteBook", () => {
		it("removes the book so it can no longer be retrieved", async () => {
			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});

			expect(await bookRepository.getBook(userId, bookId)).not.toBeNull();

			await bookRepository.deleteBook(userId, bookId);

			expect(await bookRepository.getBook(userId, bookId)).toBeNull();
		});

		it("is a no-op for a non-existent book", async () => {
			await expect(
				bookRepository.deleteBook(userId, "non-existent"),
			).resolves.toBeUndefined();
		});

		// Assigns one author, series, tag and publisher to an existing book.
		const assignRelations = async (
			bookId: string,
			ids: {
				authorId: string;
				seriesId: string;
				tagId: string;
				publisherId: string;
			},
		): Promise<void> => {
			const book = await bookRepository.getBook(userId, bookId);
			if (!book) throw new Error(`book ${bookId} not found`);
			await bookRepository.updateBook(userId, {
				...book,
				authorIds: [ids.authorId],
				seriesId: ids.seriesId,
				tagIds: [ids.tagId],
				bookshelfIds: [],
				publisherId: ids.publisherId,
			});
		};

		it("removes related entities that are no longer referenced", async () => {
			const author = await authorRepository.create(userId, "Author");
			const series = await seriesRepository.create(userId, "Series");
			const tag = await tagRepository.create(userId, "Tag");
			const publisher = await publisherRepository.create(userId, "Publisher");

			const { bookId } = await bookRepository.createBook({
				userId,
				file: createTestFile("book.epub"),
			});
			await assignRelations(bookId, {
				authorId: author.id,
				seriesId: series.id,
				tagId: tag.id,
				publisherId: publisher.id,
			});

			const authorRef = doc(db, "users", userId, "authors", author.id);
			const seriesRef = doc(db, "users", userId, "series", series.id);
			const tagRef = doc(db, "users", userId, "tags", tag.id);
			const publisherRef = doc(db, "users", userId, "publishers", publisher.id);
			expect((await getDoc(authorRef)).data()?.bookCount).toBe(1);
			expect((await getDoc(seriesRef)).data()?.bookCount).toBe(1);
			expect((await getDoc(tagRef)).data()?.bookCount).toBe(1);
			expect((await getDoc(publisherRef)).data()?.bookCount).toBe(1);

			await bookRepository.deleteBook(userId, bookId);

			// bookCount reached 0 → the related docs are removed
			expect((await getDoc(authorRef)).exists()).toBe(false);
			expect((await getDoc(seriesRef)).exists()).toBe(false);
			expect((await getDoc(tagRef)).exists()).toBe(false);
			expect((await getDoc(publisherRef)).exists()).toBe(false);
		});

		it("keeps related entities still referenced by other books", async () => {
			const author = await authorRepository.create(userId, "Author");
			const series = await seriesRepository.create(userId, "Series");
			const tag = await tagRepository.create(userId, "Tag");
			const publisher = await publisherRepository.create(userId, "Publisher");
			const ids = {
				authorId: author.id,
				seriesId: series.id,
				tagId: tag.id,
				publisherId: publisher.id,
			};

			const { bookId: firstId } = await bookRepository.createBook({
				userId,
				file: createTestFile("first.epub"),
			});
			await assignRelations(firstId, ids);

			const { bookId: secondId } = await bookRepository.createBook({
				userId,
				file: createTestFile("second.epub"),
			});
			await assignRelations(secondId, ids);

			const authorRef = doc(db, "users", userId, "authors", author.id);
			const seriesRef = doc(db, "users", userId, "series", series.id);
			const tagRef = doc(db, "users", userId, "tags", tag.id);
			const publisherRef = doc(db, "users", userId, "publishers", publisher.id);
			expect((await getDoc(authorRef)).data()?.bookCount).toBe(2);
			expect((await getDoc(seriesRef)).data()?.bookCount).toBe(2);
			expect((await getDoc(tagRef)).data()?.bookCount).toBe(2);
			expect((await getDoc(publisherRef)).data()?.bookCount).toBe(2);

			await bookRepository.deleteBook(userId, firstId);

			// Still referenced by the second book → docs survive, count decremented
			expect((await getDoc(authorRef)).data()?.bookCount).toBe(1);
			expect((await getDoc(seriesRef)).data()?.bookCount).toBe(1);
			expect((await getDoc(tagRef)).data()?.bookCount).toBe(1);
			expect((await getDoc(publisherRef)).data()?.bookCount).toBe(1);
		});
	});

	describe("subscribeToBooks", () => {
		it("emits an empty array when no books exist", async () => {
			const books = await new Promise<Book[]>((resolve, reject) => {
				const timeout = setTimeout(() => {
					unsubscribe();
					reject(new Error("Timed out waiting for empty books snapshot"));
				}, 5000);
				const unsubscribe = bookRepository.subscribeToBooks(userId, {
					onData: (data) => {
						if (data.length === 0) {
							clearTimeout(timeout);
							unsubscribe();
							resolve(data);
						}
					},
					onError: (err) => {
						clearTimeout(timeout);
						unsubscribe();
						reject(err);
					},
				});
			});

			expect(books).toEqual([]);
		});

		it("returns books sorted by createdAt descending", async () => {
			const { bookId: firstId } = await bookRepository.createBook({
				userId,
				file: createTestFile("first.epub"),
			});
			const firstBook = await bookRepository.getBook(userId, firstId);
			if (firstBook) {
				await bookRepository.updateBook(userId, {
					...firstBook,
					title: "First Book",
				});
			}

			const { bookId: secondId } = await bookRepository.createBook({
				userId,
				file: createTestFile("second.epub"),
			});
			const secondBook = await bookRepository.getBook(userId, secondId);
			if (secondBook) {
				await bookRepository.updateBook(userId, {
					...secondBook,
					title: "Second Book",
				});
			}

			const books = await new Promise<Book[]>((resolve) => {
				const unsubscribe = bookRepository.subscribeToBooks(userId, {
					onData: (data) => {
						if (data.length === 2 && data.every((book) => book.title)) {
							unsubscribe();
							resolve(data);
						}
					},
					onError: () => {},
				});
			});

			expect(books).toHaveLength(2);
			expect(books[0].title).toBe("Second Book");
			expect(books[1].title).toBe("First Book");
		});
	});
});
