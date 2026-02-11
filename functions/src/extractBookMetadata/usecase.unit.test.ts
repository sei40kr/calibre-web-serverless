import {
	AMAZON,
	GOODREADS,
	GOOGLE,
	ISBN,
	ISBN13,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import { describe, expect, it } from "vitest";
import {
	resolveIdentifierType,
	resolveLanguage,
	titleFromFilename,
} from "./usecase";

describe("titleFromFilename", () => {
	it("strips extension and replaces hyphens with spaces", () => {
		expect(titleFromFilename("my-great-book.epub")).toBe("my great book");
	});

	it("replaces underscores with spaces", () => {
		expect(titleFromFilename("my_great_book.pdf")).toBe("my great book");
	});

	it("returns null when originalName is undefined", () => {
		expect(titleFromFilename()).toBeNull();
	});

	it("returns null when result would be empty", () => {
		expect(titleFromFilename(".epub")).toBeNull();
	});

	it("handles multiple dots (only strips last extension)", () => {
		expect(titleFromFilename("my.great.book.epub")).toBe("my.great.book");
	});

	it("collapses multiple spaces", () => {
		expect(titleFromFilename("my--book.epub")).toBe("my book");
	});
});

describe("resolveIdentifierType", () => {
	it("maps isbn", () => {
		expect(resolveIdentifierType("isbn")).toBe(ISBN);
	});

	it("maps isbn13", () => {
		expect(resolveIdentifierType("isbn13")).toBe(ISBN13);
	});

	it("maps isbn-13 to ISBN13", () => {
		expect(resolveIdentifierType("isbn-13")).toBe(ISBN13);
	});

	it("maps amazon", () => {
		expect(resolveIdentifierType("amazon")).toBe(AMAZON);
	});

	it("maps asin to AMAZON", () => {
		expect(resolveIdentifierType("asin")).toBe(AMAZON);
	});

	it("maps google", () => {
		expect(resolveIdentifierType("google")).toBe(GOOGLE);
	});

	it("maps goodreads", () => {
		expect(resolveIdentifierType("goodreads")).toBe(GOODREADS);
	});

	it("is case-insensitive", () => {
		expect(resolveIdentifierType("ISBN")).toBe(ISBN);
		expect(resolveIdentifierType("Amazon")).toBe(AMAZON);
		expect(resolveIdentifierType("ASIN")).toBe(AMAZON);
	});

	it("returns null for unknown types", () => {
		expect(resolveIdentifierType("unknown")).toBeNull();
		expect(resolveIdentifierType("doi")).toBeNull();
	});
});

describe("resolveLanguage", () => {
	it("passes through known 2-letter codes", () => {
		expect(resolveLanguage("en")).toBe(Language.EN);
		expect(resolveLanguage("ja")).toBe(Language.JA);
		expect(resolveLanguage("de")).toBe(Language.DE);
		expect(resolveLanguage("fr")).toBe(Language.FR);
	});

	it("truncates 3-letter codes whose first 2 chars are known", () => {
		expect(resolveLanguage("eng")).toBe(Language.EN);
		expect(resolveLanguage("fra")).toBe(Language.FR);
		expect(resolveLanguage("deu")).toBe(Language.DE);
	});

	it("returns null for 3-letter codes whose first 2 chars are unknown", () => {
		expect(resolveLanguage("jpn")).toBeNull();
	});

	it("truncates locale codes", () => {
		expect(resolveLanguage("en-US")).toBe(Language.EN);
		expect(resolveLanguage("zh-TW")).toBe(Language.ZH);
	});

	it("is case-insensitive", () => {
		expect(resolveLanguage("EN")).toBe(Language.EN);
		expect(resolveLanguage("JA")).toBe(Language.JA);
	});

	it("returns null for unknown codes", () => {
		expect(resolveLanguage("xx")).toBeNull();
		expect(resolveLanguage("zz")).toBeNull();
	});
});
