import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../testing/clearFirestore";
import { deleteUserData } from "./usecase";

const objectExists = async (path: string) =>
	(await getStorage().bucket().file(path).exists())[0];

describe("deleteUserData", () => {
	beforeEach(async () => {
		await clearFirestore();
	});

	it("deletes the user's documents and objects, and nobody else's", async () => {
		const db = getFirestore();
		await db.doc("users/alice").set({});
		await db.doc("users/alice/books/b1").set({ title: "A" });
		await db.doc("users/alice/bookshelves/s1").set({ name: "S" });
		await db.doc("users/bob/books/b2").set({ title: "B" });
		const bucket = getStorage().bucket();
		await bucket.file("users/alice/books/b1/book.epub").save("x");
		await bucket.file("users/alice-2/books/b3/book.epub").save("x");
		await bucket.file("users/bob/books/b2/book.epub").save("x");

		await deleteUserData("alice");

		expect((await db.doc("users/alice").get()).exists).toBe(false);
		expect((await db.doc("users/alice/books/b1").get()).exists).toBe(false);
		expect((await db.doc("users/alice/bookshelves/s1").get()).exists).toBe(
			false,
		);
		expect((await db.doc("users/bob/books/b2").get()).exists).toBe(true);
		expect(await objectExists("users/alice/books/b1/book.epub")).toBe(false);
		// The trailing slash in the prefix keeps a uid that merely starts with
		// "alice" out of the deletion.
		expect(await objectExists("users/alice-2/books/b3/book.epub")).toBe(true);
		expect(await objectExists("users/bob/books/b2/book.epub")).toBe(true);
	});
});
