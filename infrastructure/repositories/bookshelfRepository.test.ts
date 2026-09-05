import { BookshelfError } from "@calibre-web-serverless/domain/errors/bookshelfError";
import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bookshelfMembershipService } from "../services/bookshelfMembershipService";
import { clearFirestore } from "../testing/clearFirestore";
import { signInTestUser } from "../testing/testUser";
import { bookRepository } from "./bookRepository";
import { bookshelfRepository } from "./bookshelfRepository";

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

describe("bookshelfRepository", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	describe("create", () => {
		it("creates an empty bookshelf with the normalised name", async () => {
			const bookshelf = await bookshelfRepository.create(
				userId,
				"  To   Read ",
			);

			expect(bookshelf.id.length).toBeGreaterThan(0);
			expect(bookshelf.name).toBe("To Read");
			expect(bookshelf.bookCount).toBe(0);

			const stored = await getBookshelf(bookshelf.id);
			expect(stored).toMatchObject({ name: "To Read", bookCount: 0 });
			expect(stored?.createdAt).toBeInstanceOf(Date);
		});

		it("rejects a blank name", async () => {
			await expect(
				bookshelfRepository.create(userId, "   "),
			).rejects.toMatchObject({ code: "invalid-name" });
		});

		it("rejects a name already used by another bookshelf", async () => {
			await bookshelfRepository.create(userId, "Favourites");

			const error = await bookshelfRepository
				.create(userId, " Favourites ")
				.catch((e) => e);
			expect(error).toBeInstanceOf(BookshelfError);
			expect(error.code).toBe("duplicate-name");
		});
	});

	describe("update", () => {
		it("stores the normalised new name", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "To Read");

			await bookshelfRepository.update(userId, {
				...bookshelf,
				name: "  Read   Later ",
			});

			expect((await getBookshelf(bookshelf.id))?.name).toBe("Read Later");
		});

		it("allows a bookshelf to keep its own name", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "To Read");

			await bookshelfRepository.update(userId, {
				...bookshelf,
				name: " To  Read ",
			});

			expect((await getBookshelf(bookshelf.id))?.name).toBe("To Read");
		});

		it("never writes the denormalised bookCount", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "To Read");
			const bookId = await createBook();
			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);

			// A stale count on the model must not clobber the maintained one.
			await bookshelfRepository.update(userId, {
				...bookshelf,
				name: "Read Later",
				bookCount: 0,
			});

			expect((await getBookshelf(bookshelf.id))?.bookCount).toBe(1);
		});

		it("rejects a blank name", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "To Read");

			await expect(
				bookshelfRepository.update(userId, { ...bookshelf, name: "   " }),
			).rejects.toMatchObject({ code: "invalid-name" });
		});

		it("rejects a name used by another bookshelf", async () => {
			await bookshelfRepository.create(userId, "Favourites");
			const bookshelf = await bookshelfRepository.create(userId, "To Read");

			const error = await bookshelfRepository
				.update(userId, { ...bookshelf, name: " Favourites " })
				.catch((e) => e);
			expect(error).toBeInstanceOf(BookshelfError);
			expect(error.code).toBe("duplicate-name");
			expect((await getBookshelf(bookshelf.id))?.name).toBe("To Read");
		});

		it("rejects an unknown bookshelf", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "To Read");
			await bookshelfRepository.delete(userId, bookshelf.id);

			await expect(
				bookshelfRepository.update(userId, { ...bookshelf, name: "Anything" }),
			).rejects.toMatchObject({ code: "bookshelf-not-found" });
		});
	});

	describe("getAll / subscribeToBookshelves", () => {
		it("lists bookshelves sorted by name", async () => {
			await bookshelfRepository.create(userId, "Sci-Fi");
			await bookshelfRepository.create(userId, "Classics");

			const bookshelves = await bookshelfRepository.getAll(userId);
			expect(bookshelves.map((bookshelf) => bookshelf.name)).toEqual([
				"Classics",
				"Sci-Fi",
			]);

			const live = await new Promise<Bookshelf[]>((resolve, reject) => {
				const unsubscribe = bookshelfRepository.subscribeToBookshelves(userId, {
					onData: (data) => {
						unsubscribe();
						resolve(data);
					},
					onError: reject,
				});
			});
			expect(live.map((bookshelf) => bookshelf.name)).toEqual([
				"Classics",
				"Sci-Fi",
			]);
		});
	});

	describe("delete", () => {
		it("removes the bookshelf and its membership from every book", async () => {
			const bookshelf = await bookshelfRepository.create(userId, "Favourites");
			const other = await bookshelfRepository.create(userId, "Other");
			const bookId = await createBook();
			await bookshelfMembershipService.addBook(userId, bookshelf.id, bookId);
			await bookshelfMembershipService.addBook(userId, other.id, bookId);

			await bookshelfRepository.delete(userId, bookshelf.id);

			expect(await getBookshelf(bookshelf.id)).toBeUndefined();
			expect(await bookshelfIdsOf(bookId)).toEqual([other.id]);
			expect((await getBookshelf(other.id))?.bookCount).toBe(1);
		});
	});
});
