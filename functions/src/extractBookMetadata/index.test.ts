import { describe, expect, it } from "vitest";
import { parseStoragePath } from "./index";

describe("parseStoragePath", () => {
	it("parses a valid epub path", () => {
		expect(parseStoragePath("users/abc/books/def/book.epub")).toEqual({
			userId: "abc",
			bookId: "def",
			format: "epub",
		});
	});

	it("parses a valid pdf path", () => {
		expect(parseStoragePath("users/u1/books/b1/book.pdf")).toEqual({
			userId: "u1",
			bookId: "b1",
			format: "pdf",
		});
	});

	it("returns null for wrong filename prefix", () => {
		expect(parseStoragePath("users/abc/books/def/file.epub")).toBeNull();
	});

	it("returns null for extra segments", () => {
		expect(parseStoragePath("users/abc/books/def/extra/book.epub")).toBeNull();
	});

	it("returns null for too few segments", () => {
		expect(parseStoragePath("users/abc/book.epub")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseStoragePath("")).toBeNull();
	});

	it("returns null for path without extension", () => {
		expect(parseStoragePath("users/abc/books/def/book")).toBeNull();
	});
});
