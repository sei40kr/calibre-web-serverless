import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import {
	buildAcquisitionFeed,
	buildNavigationFeed,
	type FeedEntry,
} from "./feed";

const NOW = new Date("2026-01-01T00:00:00.000Z");

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
});

// biome-ignore lint/suspicious/noExplicitAny: parsed XML is dynamically shaped
const parse = (xml: string): any => parser.parse(xml);
// biome-ignore lint/suspicious/noExplicitAny: link nodes are dynamically shaped
const asArray = (value: any): any[] => (Array.isArray(value) ? value : [value]);

function entry(overrides: Partial<FeedEntry> = {}): FeedEntry {
	return {
		id: "book1",
		title: "A Book",
		authors: ["Jane Doe"],
		updated: new Date("2025-12-31T00:00:00.000Z"),
		language: "en",
		publisher: "ACME",
		issued: new Date("2020-06-01T00:00:00.000Z"),
		summary: "A summary",
		categories: ["fiction"],
		files: [{ format: "epub", fileSize: 1234 }],
		hasCover: true,
		...overrides,
	};
}

describe("buildNavigationFeed", () => {
	it("emits an XML declaration", () => {
		expect(buildNavigationFeed(NOW)).toContain(
			'<?xml version="1.0" encoding="UTF-8"?>',
		);
	});

	it("links to the all-books acquisition feed", () => {
		const { feed } = parse(buildNavigationFeed(NOW));
		expect(feed.title).toBe("Calibre-Web Serverless");
		expect(feed.entry.link["@_href"]).toBe("/opds/books");
		expect(feed.entry.link["@_type"]).toContain("kind=acquisition");
	});
});

describe("buildAcquisitionFeed", () => {
	const findLink = (links: unknown, rel: string) =>
		asArray(links).find((l) => l["@_rel"] === rel);

	it("renders an entry with metadata, download and cover links", () => {
		const { feed } = parse(
			buildAcquisitionFeed({
				entries: [entry()],
				page: 1,
				itemsPerPage: 50,
				totalResults: 1,
				now: NOW,
			}),
		);
		const { entry: e } = feed;
		expect(e.title).toBe("A Book");
		expect(e.id).toBe("urn:uuid:book1");
		expect(e.author.name).toBe("Jane Doe");
		expect(e["dc:language"]).toBe("en");
		expect(e["dc:publisher"]).toBe("ACME");
		expect(e.category["@_term"]).toBe("fiction");

		const acquisition = findLink(e.link, "http://opds-spec.org/acquisition");
		expect(acquisition["@_href"]).toBe("/opds/download/book1.epub");
		expect(acquisition["@_type"]).toBe("application/epub+zip");
		expect(acquisition["@_length"]).toBe("1234");

		expect(findLink(e.link, "http://opds-spec.org/image")["@_href"]).toBe(
			"/opds/cover/book1",
		);
		expect(
			findLink(e.link, "http://opds-spec.org/image/thumbnail")["@_href"],
		).toBe("/opds/cover/book1/thumbnail");
	});

	it("renders one acquisition link per file", () => {
		const { feed } = parse(
			buildAcquisitionFeed({
				entries: [
					entry({
						files: [
							{ format: "epub", fileSize: 1234 },
							{ format: "pdf", fileSize: 5678 },
						],
					}),
				],
				page: 1,
				itemsPerPage: 50,
				totalResults: 1,
				now: NOW,
			}),
		);
		const acquisitions = asArray(feed.entry.link).filter(
			(l) => l["@_rel"] === "http://opds-spec.org/acquisition",
		);
		expect(acquisitions).toHaveLength(2);
		expect(acquisitions.map((l) => l["@_href"])).toEqual([
			"/opds/download/book1.epub",
			"/opds/download/book1.pdf",
		]);
		expect(acquisitions.map((l) => l["@_type"])).toEqual([
			"application/epub+zip",
			"application/pdf",
		]);
	});

	it("omits cover links when there is no cover", () => {
		const xml = buildAcquisitionFeed({
			entries: [entry({ hasCover: false })],
			page: 1,
			itemsPerPage: 50,
			totalResults: 1,
			now: NOW,
		});
		expect(xml).not.toContain("/opds/cover/");
	});

	it("emits opensearch pagination metadata", () => {
		const { feed } = parse(
			buildAcquisitionFeed({
				entries: [],
				page: 2,
				itemsPerPage: 50,
				totalResults: 120,
				now: NOW,
			}),
		);
		expect(Number(feed["opensearch:totalResults"])).toBe(120);
		expect(Number(feed["opensearch:startIndex"])).toBe(51);
	});

	it("includes next/previous links only when applicable", () => {
		const middle = parse(
			buildAcquisitionFeed({
				entries: [],
				page: 2,
				itemsPerPage: 50,
				totalResults: 150,
				now: NOW,
			}),
		).feed;
		expect(findLink(middle.link, "next")["@_href"]).toBe("/opds/books?page=3");
		expect(findLink(middle.link, "previous")["@_href"]).toBe(
			"/opds/books?page=1",
		);

		const first = parse(
			buildAcquisitionFeed({
				entries: [],
				page: 1,
				itemsPerPage: 50,
				totalResults: 10,
				now: NOW,
			}),
		).feed;
		expect(findLink(first.link, "next")).toBeUndefined();
		expect(findLink(first.link, "previous")).toBeUndefined();
	});

	it("escapes XML special characters in titles", () => {
		const xml = buildAcquisitionFeed({
			entries: [entry({ title: "Tom & Jerry <fun>" })],
			page: 1,
			itemsPerPage: 50,
			totalResults: 1,
			now: NOW,
		});
		// Raw output is escaped...
		expect(xml).toContain("Tom &amp; Jerry &lt;fun&gt;");
		// ...and round-trips back to the original on parse.
		expect(parse(xml).feed.entry.title).toBe("Tom & Jerry <fun>");
	});
});
