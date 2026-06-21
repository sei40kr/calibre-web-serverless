import type { BookMetadataSearchResult } from "@calibre-web-serverless/domain/models/bookMetadataSearch";
import { describe, expect, it, vi } from "vitest";
import { searchBookMetadata } from "./search";
import type { MetadataProvider } from "./types";

function result(source: string, id: string): BookMetadataSearchResult {
	return {
		source,
		sourceName: source,
		id,
		title: id,
		authors: [],
		publisher: null,
		publishedDate: null,
		description: null,
		languages: [],
		identifiers: [],
		tags: [],
		coverUrl: null,
		infoUrl: null,
	};
}

function provider(
	source: string,
	impl: () => Promise<BookMetadataSearchResult[]>,
): MetadataProvider {
	return { source, sourceName: source, search: impl };
}

describe("searchBookMetadata", () => {
	it("returns empty for a blank query without calling providers", async () => {
		const search = vi.fn();
		const response = await searchBookMetadata({ query: "   " }, [
			provider("a", search),
		]);
		expect(response).toEqual({ results: [], errors: [] });
		expect(search).not.toHaveBeenCalled();
	});

	it("aggregates results from all providers in parallel", async () => {
		const registry = [
			provider("a", async () => [result("a", "1")]),
			provider("b", async () => [result("b", "2")]),
		];
		const response = await searchBookMetadata({ query: "x" }, registry);
		expect(response.results.map((r) => r.id)).toEqual(["1", "2"]);
		expect(response.errors).toEqual([]);
	});

	it("reports a failing provider without dropping healthy results", async () => {
		const registry = [
			provider("a", async () => [result("a", "1")]),
			provider("b", async () => {
				throw new Error("boom");
			}),
		];
		const response = await searchBookMetadata({ query: "x" }, registry);
		expect(response.results.map((r) => r.id)).toEqual(["1"]);
		expect(response.errors).toEqual([
			{ source: "b", sourceName: "b", message: "boom" },
		]);
	});

	it("restricts to the requested sources", async () => {
		const bSearch = vi.fn(async () => [result("b", "2")]);
		const registry = [
			provider("a", async () => [result("a", "1")]),
			provider("b", bSearch),
		];
		const response = await searchBookMetadata(
			{ query: "x", sources: ["b"] },
			registry,
		);
		expect(response.results.map((r) => r.id)).toEqual(["2"]);
		expect(bSearch).toHaveBeenCalledOnce();
	});
});
