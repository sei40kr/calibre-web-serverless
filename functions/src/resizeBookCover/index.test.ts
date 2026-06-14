import { describe, expect, it } from "vitest";
import { parseCoverUploadPath } from "./index";

describe("parseCoverUploadPath", () => {
	it("parses a valid cover upload path", () => {
		expect(
			parseCoverUploadPath("users/abc/books/def/cover_upload.jpg"),
		).toEqual({ userId: "abc", bookId: "def", ext: "jpg" });
	});

	it("parses webp and png extensions", () => {
		expect(parseCoverUploadPath("users/u1/books/b1/cover_upload.webp")).toEqual(
			{ userId: "u1", bookId: "b1", ext: "webp" },
		);
		expect(parseCoverUploadPath("users/u1/books/b1/cover_upload.png")).toEqual({
			userId: "u1",
			bookId: "b1",
			ext: "png",
		});
	});

	it("does not match the processed outputs (avoids self-retrigger)", () => {
		expect(parseCoverUploadPath("users/abc/books/def/cover.png")).toBeNull();
		expect(
			parseCoverUploadPath("users/abc/books/def/custom_cover.png"),
		).toBeNull();
	});

	it("does not match the book file path", () => {
		expect(parseCoverUploadPath("users/abc/books/def/book.epub")).toBeNull();
	});

	it("returns null for extra segments", () => {
		expect(
			parseCoverUploadPath("users/abc/books/def/extra/cover_upload.jpg"),
		).toBeNull();
	});

	it("returns null for a missing extension", () => {
		expect(parseCoverUploadPath("users/abc/books/def/cover_upload")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseCoverUploadPath("")).toBeNull();
	});
});
