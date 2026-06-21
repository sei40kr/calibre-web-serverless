import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildSearchUrl,
	googlePlayBooksProvider,
	mapVolume,
	upgradeCoverUrl,
} from "./googlePlayBooks";

describe("buildSearchUrl", () => {
	it("encodes the query and sets defaults", () => {
		const url = new URL(buildSearchUrl("the hobbit tolkien", 10));
		expect(url.origin + url.pathname).toBe(
			"https://www.googleapis.com/books/v1/volumes",
		);
		expect(url.searchParams.get("q")).toBe("the hobbit tolkien");
		expect(url.searchParams.get("printType")).toBe("books");
		expect(url.searchParams.get("country")).toBe("US");
		expect(url.searchParams.get("maxResults")).toBe("10");
		expect(url.searchParams.has("key")).toBe(false);
	});

	it("uses the caller-supplied maxResults", () => {
		const url = new URL(buildSearchUrl("x", 25));
		expect(url.searchParams.get("maxResults")).toBe("25");
	});

	it("includes the api key and country override when provided", () => {
		const url = new URL(
			buildSearchUrl("x", 10, { country: "JP", apiKey: "secret" }),
		);
		expect(url.searchParams.get("country")).toBe("JP");
		expect(url.searchParams.get("key")).toBe("secret");
	});
});

describe("upgradeCoverUrl", () => {
	it("returns null when no url", () => {
		expect(upgradeCoverUrl(undefined)).toBeNull();
	});

	it("upgrades to https, removes edge curl, and bumps zoom", () => {
		const input =
			"http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl";
		expect(upgradeCoverUrl(input)).toBe(
			"https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=2",
		);
	});
});

describe("mapVolume", () => {
	it("maps a full volume into a normalised result", () => {
		const result = mapVolume({
			id: "vol123",
			volumeInfo: {
				title: "The Hobbit",
				authors: ["J.R.R. Tolkien"],
				publisher: "George Allen & Unwin",
				publishedDate: "1937-09-21",
				description: "A hobbit goes on an adventure.",
				language: "en",
				categories: ["Fiction", "Fantasy"],
				industryIdentifiers: [
					{ type: "ISBN_13", identifier: "9780261103283" },
					{ type: "ISBN_10", identifier: "0261103288" },
					{ type: "OTHER", identifier: "ignore-me" },
				],
				imageLinks: {
					thumbnail:
						"http://books.google.com/books/content?id=vol123&zoom=1&edge=curl",
				},
				canonicalVolumeLink:
					"https://play.google.com/store/books/details?id=vol123",
			},
		});

		expect(result).not.toBeNull();
		expect(result).toMatchObject({
			source: "google_play_books",
			sourceName: "Google Play Books",
			id: "vol123",
			title: "The Hobbit",
			authors: ["J.R.R. Tolkien"],
			publisher: "George Allen & Unwin",
			publishedDate: "1937-09-21",
			languages: ["en"],
			tags: ["Fiction", "Fantasy"],
			infoUrl: "https://play.google.com/store/books/details?id=vol123",
		});
		expect(result?.coverUrl).toBe(
			"https://books.google.com/books/content?id=vol123&zoom=2",
		);
		// Known ISBN schemes mapped, OTHER dropped, google id always appended.
		expect(result?.identifiers).toEqual([
			{ type: "isbn13", value: "9780261103283" },
			{ type: "isbn", value: "0261103288" },
			{ type: "google", value: "vol123" },
		]);
	});

	it("returns null without an id or title", () => {
		expect(mapVolume({ volumeInfo: { title: "No id" } })).toBeNull();
		expect(mapVolume({ id: "x", volumeInfo: {} })).toBeNull();
		expect(mapVolume({ id: "x" })).toBeNull();
	});

	it("defaults missing optional fields", () => {
		const result = mapVolume({ id: "x", volumeInfo: { title: "Bare" } });
		expect(result).toMatchObject({
			authors: [],
			publisher: null,
			publishedDate: null,
			description: null,
			languages: [],
			tags: [],
			coverUrl: null,
			infoUrl: null,
			identifiers: [{ type: "google", value: "x" }],
		});
	});
});

describe("googlePlayBooksProvider.search", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches and maps results", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				items: [
					{ id: "a", volumeInfo: { title: "A" } },
					{ volumeInfo: { title: "no id, dropped" } },
				],
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const results = await googlePlayBooksProvider.search("query", 10);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("a");
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("throws on a non-ok response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("nope", { status: 503 })),
		);
		await expect(googlePlayBooksProvider.search("query", 10)).rejects.toThrow(
			/503/,
		);
	});

	it("throws a friendly rate-limit message on 429", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("slow down", { status: 429 })),
		);
		await expect(googlePlayBooksProvider.search("query", 10)).rejects.toThrow(
			/rate limited/i,
		);
	});
});
