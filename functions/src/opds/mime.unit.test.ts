import { describe, expect, it } from "vitest";
import { bookMimeType } from "./mime";

describe("bookMimeType", () => {
	it("maps known formats", () => {
		expect(bookMimeType("epub")).toBe("application/epub+zip");
		expect(bookMimeType("pdf")).toBe("application/pdf");
	});

	it("is case-insensitive", () => {
		expect(bookMimeType("EPUB")).toBe("application/epub+zip");
	});

	it("falls back to octet-stream for unknown formats", () => {
		expect(bookMimeType("xyz")).toBe("application/octet-stream");
	});
});
