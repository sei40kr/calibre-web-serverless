import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBookCover, isAllowedCoverHost } from "./fetchCover";

describe("isAllowedCoverHost", () => {
	it("allows Google cover hosts", () => {
		expect(isAllowedCoverHost("books.google.com")).toBe(true);
		expect(isAllowedCoverHost("play-lh.googleusercontent.com")).toBe(true);
	});

	it("rejects arbitrary hosts", () => {
		expect(isAllowedCoverHost("evil.example.com")).toBe(false);
		// Guards against suffix-spoofing like "google.com.evil.com".
		expect(isAllowedCoverHost("google.com.evil.com")).toBe(false);
	});
});

describe("fetchBookCover", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects a disallowed host before fetching", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			fetchBookCover("https://evil.example.com/cover.jpg"),
		).rejects.toThrow(/not allowed/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects an invalid url", async () => {
		await expect(fetchBookCover("not a url")).rejects.toThrow(/Invalid/);
	});

	it("downloads and base64-encodes an allowed cover", async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]);
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(bytes, {
						status: 200,
						headers: { "content-type": "image/jpeg" },
					}),
			),
		);
		const out = await fetchBookCover(
			"https://books.google.com/books/content?id=x",
		);
		expect(out.contentType).toBe("image/jpeg");
		expect(Buffer.from(out.dataBase64, "base64")).toEqual(Buffer.from(bytes));
	});

	it("coerces unexpected image types to jpeg", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(new Uint8Array([1]), {
						status: 200,
						headers: { "content-type": "image/gif" },
					}),
			),
		);
		const out = await fetchBookCover(
			"https://books.google.com/books/content?id=x",
		);
		expect(out.contentType).toBe("image/jpeg");
	});
});
