import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { deleteDoc, doc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/firebase";
import { bookRepository } from "../repositories/bookRepository";
import { bookshelfRepository } from "../repositories/bookshelfRepository";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { bookshelfMembershipService } from "./bookshelfMembershipService";

let userId: string;

beforeAll(async () => {
	userId = await signInTestUser();
});

const createBook = async (): Promise<string> => {
	const { bookId } = await bookRepository.createBook({
		userId,
		file: new File(["dummy"], "book.epub", {
			type: "application/octet-stream",
		}),
	});
	return bookId;
};

const getBookshelf = async (
	bookshelfId: string,
): Promise<Bookshelf | undefined> =>
	(await bookshelfRepository.getAll(userId)).find(
		(bookshelf) => bookshelf.id === bookshelfId,
	);

const bookshelfIdsOf = async (bookId: string): Promise<string[]> =>
	(await bookRepository.getBook(userId, bookId))?.bookshelfIds ?? [];

/** Resolves with the bookshelf-scoped book ids once the subscription settles. */
const booksOnBookshelf = (bookshelfId: string): Promise<string[]> =>
	new Promise((resolve, reject) => {
		const unsubscribe = bookRepository.subscribeToBooks(userId, {
			bookshelfId,
			onData: (books) => {
				unsubscribe();
				resolve(books.map((book) => book.id));
			},
			onError: reject,
		});
	});

describe("bookshelfMembershipService", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("addBook / removeBook", () => {
		it("records membership on the book and keeps the count in step", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "Favourites");
			const bookId = await createBook();

			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);
			// Adding twice must not double count.
			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);

			expect(await bookshelfIdsOf(bookId)).toEqual([bookshelf.id]);
			expect((await getBookshelf(bookshelf.id))?.bookCount).toBe(1);
			expect(await booksOnBookshelf(bookshelf.id)).toEqual([bookId]);

			await bookshelfMembershipService.removeBook(userId, bookshelf.id, bookId);
			await bookshelfMembershipService.removeBook(userId, bookshelf.id, bookId);

			expect(await bookshelfIdsOf(bookId)).toEqual([]);
			expect((await getBookshelf(bookshelf.id))?.bookCount).toBe(0);
			expect(await booksOnBookshelf(bookshelf.id)).toEqual([]);
		});

		it("scopes the subscription to the requested bookshelf only", async () => {
			const bookshelfA = await bookshelfRepository.create(userId, "A");
			const bookshelfB = await bookshelfRepository.create(userId, "B");
			const inA = await createBook();
			const inBoth = await createBook();
			await createBook();

			await bookshelfMembershipService.addBook(userId, bookshelfA.id, inA);
			await bookshelfMembershipService.addBook(userId, bookshelfA.id, inBoth);
			await bookshelfMembershipService.addBook(userId, bookshelfB.id, inBoth);

			expect((await booksOnBookshelf(bookshelfA.id)).sort()).toEqual(
				[inA, inBoth].sort(),
			);
			expect(await booksOnBookshelf(bookshelfB.id)).toEqual([inBoth]);
		});

		it("rejects adding to an unknown bookshelf or book", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "Favourites");
			const bookId = await createBook();

			await expect(
				bookshelfMembershipService.addBook(userId, "missing", bookId),
			).rejects.toMatchObject({ code: "bookshelf-not-found" });
			await expect(
				bookshelfMembershipService.addBook(userId, bookshelf.id, "missing"),
			).rejects.toMatchObject({ code: "book-not-found" });
		});

		it("removes a membership whose bookshelf no longer exists", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "Favourites");
			const bookId = await createBook();
			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);

			// Simulate an interrupted delete: the bookshelf doc is gone but the
			// membership was never stripped from the book.
			await deleteDoc(doc(db, "users", userId, "bookshelves", bookshelf.id));
			expect(await bookshelfIdsOf(bookId)).toEqual([bookshelf.id]);

			await bookshelfMembershipService.removeBook(userId, bookshelf.id, bookId);

			expect(await bookshelfIdsOf(bookId)).toEqual([]);
		});

		it("survives a metadata update of the book", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "Favourites");
			const bookId = await createBook();
			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);

			const book = await bookRepository.getBook(userId, bookId);
			if (!book) throw new Error("book missing");
			await bookRepository.updateBook(userId, {
				...book,
				title: "Renamed",
				// A stale membership snapshot on the model must not be written back.
				bookshelfIds: [],
			});

			expect(await bookshelfIdsOf(bookId)).toEqual([bookshelf.id]);
		});
	});

	describe("deleting a book", () => {
		it("decrements the count of every bookshelf it was on", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "Favourites");
			const bookId = await createBook();
			const keptBookId = await createBook();
			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);
			await bookshelfMembershipService.addBook(
				userId,
				bookshelf.id,
				keptBookId,
			);

			await bookRepository.deleteBook(userId, bookId);

			expect((await getBookshelf(bookshelf.id))?.bookCount).toBe(1);
			expect(await booksOnBookshelf(bookshelf.id)).toEqual([keptBookId]);
		});
	});
});
