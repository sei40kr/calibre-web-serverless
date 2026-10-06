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

	it("rejects Google hosts that serve redirects or arbitrary content", () => {
		expect(isAllowedCoverHost("www.google.com")).toBe(false);
		expect(isAllowedCoverHost("storage.googleapis.com")).toBe(false);
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

	it("follows a redirect to an allowed host", async () => {
		const fetchMock = vi.fn(async (input: URL | string) =>
			String(input).startsWith("https://books.google.com/")
				? new Response(null, {
						status: 302,
						headers: { location: "https://lh3.googleusercontent.com/c" },
					})
				: new Response(new Uint8Array([7]), {
						status: 200,
						headers: { "content-type": "image/png" },
					}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const out = await fetchBookCover(
			"https://books.google.com/books/content?id=x",
		);
		expect(out.contentType).toBe("image/png");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("refuses a redirect to a disallowed host", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: "http://169.254.169.254/computeMetadata/v1/" },
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
						headers: { location: "https://books.google.com/again" },
					}),
			),
		);
		await expect(
			fetchBookCover("https://books.google.com/books/content?id=x"),
		).rejects.toThrow(/redirected too often/);
	});

	it("rejects a body larger than the cap without a content-length", async () => {
		const chunk = new Uint8Array(1024 * 1024);
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				sent++;
				if (sent > 20) controller.close();
				else controller.enqueue(chunk);
			},
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(body, { status: 200 })),
		);
		await expect(
			fetchBookCover("https://books.google.com/books/content?id=x"),
		).rejects.toThrow(/too large/);
		expect(sent).toBeLessThan(20);
	});
});
