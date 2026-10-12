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

	it("follows redirects to allowed hosts", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { location: "https://lh3.googleusercontent.com/c.jpg" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(new Uint8Array([1]), {
					status: 200,
					headers: { "content-type": "image/jpeg" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);
		await fetchBookCover("https://books.google.com/books/content?id=x");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(String(fetchMock.mock.calls[1][0])).toBe(
			"https://lh3.googleusercontent.com/c.jpg",
		);
	});

	it("rejects a redirect to a disallowed host", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: "http://169.254.169.254/latest" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			fetchBookCover("https://books.google.com/books/content?id=x"),
		).rejects.toThrow(/not allowed/);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("gives up after too many redirects", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(null, {
						status: 302,
						headers: { location: "/loop" },
					}),
			),
		);
		await expect(
			fetchBookCover("https://books.google.com/books/content?id=x"),
		).rejects.toThrow(/Too many/);
	});

	it("rejects a cover whose Content-Length exceeds the limit", async () => {
		const cancel = vi.fn();
		const body = new ReadableStream({ cancel });
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(body, {
						status: 200,
						headers: { "content-length": String(11 * 1024 * 1024) },
					}),
			),
		);
		await expect(
			fetchBookCover("https://books.google.com/books/content?id=x"),
		).rejects.toThrow(/too large/);
		expect(cancel).toHaveBeenCalled();
	});

	it("stops reading once the body exceeds the limit", async () => {
		const chunk = new Uint8Array(1024 * 1024);
		let pulls = 0;
		const cancel = vi.fn();
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls++;
				controller.enqueue(chunk);
			},
			cancel,
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(body)),
		);
		await expect(
			fetchBookCover("https://books.google.com/books/content?id=x"),
		).rejects.toThrow(/too large/);
		expect(cancel).toHaveBeenCalled();
		expect(pulls).toBeLessThan(20);
	});
});
