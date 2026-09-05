import { describe, expect, it } from "vitest";
import {
	bookshelfNameProblem,
	isBookInBookshelf,
	MAX_BOOKSHELF_NAME_LENGTH,
	normalizeBookshelfName,
} from "./bookshelf";

describe("normalizeBookshelfName", () => {
	it("trims and collapses whitespace", () => {
		expect(normalizeBookshelfName("  To   Read \n")).toBe("To Read");
	});
});

describe("bookshelfNameProblem", () => {
	it("accepts an ordinary name", () => {
		expect(bookshelfNameProblem("Favourites")).toBeNull();
	});

	it("rejects a blank name", () => {
		expect(bookshelfNameProblem("   ")).toBe("empty");
	});

	it("rejects a name longer than the limit after normalisation", () => {
		expect(
			bookshelfNameProblem("a".repeat(MAX_BOOKSHELF_NAME_LENGTH)),
		).toBeNull();
		expect(
			bookshelfNameProblem("a".repeat(MAX_BOOKSHELF_NAME_LENGTH + 1)),
		).toBe("too-long");
	});
});

describe("isBookInBookshelf", () => {
	it("checks membership by bookshelf id", () => {
		expect(isBookInBookshelf({ bookshelfIds: ["s1", "s2"] }, "s2")).toBe(true);
		expect(isBookInBookshelf({ bookshelfIds: ["s1"] }, "s2")).toBe(false);
	});
});
