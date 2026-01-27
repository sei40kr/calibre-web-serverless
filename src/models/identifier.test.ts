import { describe, expect, it } from "vitest";
import {
	AMAZON,
	GOODREADS,
	GOOGLE,
	IdentifierType,
	ISBN,
	ISBN13,
} from "./identifier";

describe("IdentifierType", () => {
	describe("all", () => {
		it("returns all registered identifier types", () => {
			const all = IdentifierType.all();
			expect(all).toContain(ISBN);
			expect(all).toContain(ISBN13);
			expect(all).toContain(AMAZON);
			expect(all).toContain(GOOGLE);
			expect(all).toContain(GOODREADS);
		});

		it("returns a copy of the registry", () => {
			const a = IdentifierType.all();
			const b = IdentifierType.all();
			expect(a).not.toBe(b);
		});
	});

	describe("from", () => {
		it("finds identifier type by value", () => {
			expect(IdentifierType.from("isbn")).toBe(ISBN);
			expect(IdentifierType.from("isbn13")).toBe(ISBN13);
			expect(IdentifierType.from("amazon")).toBe(AMAZON);
			expect(IdentifierType.from("google")).toBe(GOOGLE);
			expect(IdentifierType.from("goodreads")).toBe(GOODREADS);
		});

		it("returns undefined for unknown value", () => {
			expect(IdentifierType.from("unknown")).toBeUndefined();
		});
	});
});

describe("ISBN", () => {
	it("has correct name and value", () => {
		expect(ISBN.name).toBe("ISBN");
		expect(ISBN.value).toBe("isbn");
	});

	it("validates correct ISBN-10", () => {
		expect(ISBN.validate("0306406152")).toBe(true);
	});

	it("validates ISBN-10 with X check digit", () => {
		expect(ISBN.validate("080442957X")).toBe(true);
	});

	it("validates ISBN-10 with hyphens", () => {
		expect(ISBN.validate("0-306-40615-2")).toBe(true);
	});

	it("validates ISBN-10 with spaces", () => {
		expect(ISBN.validate("0 306 40615 2")).toBe(true);
	});

	it("rejects empty value", () => {
		expect(ISBN.validate("")).toBe("Value is required");
		expect(ISBN.validate("   ")).toBe("Value is required");
	});

	it("rejects wrong length", () => {
		expect(ISBN.validate("123456789")).toMatch(/10 characters/);
		expect(ISBN.validate("12345678901")).toMatch(/10 characters/);
	});

	it("rejects invalid checksum", () => {
		expect(ISBN.validate("0306406153")).toBe("Invalid ISBN checksum");
	});
});

describe("ISBN13", () => {
	it("has correct name and value", () => {
		expect(ISBN13.name).toBe("ISBN13");
		expect(ISBN13.value).toBe("isbn13");
	});

	it("validates correct ISBN-13", () => {
		expect(ISBN13.validate("9780306406157")).toBe(true);
	});

	it("validates ISBN-13 with hyphens", () => {
		expect(ISBN13.validate("978-0-306-40615-7")).toBe(true);
	});

	it("rejects empty value", () => {
		expect(ISBN13.validate("")).toBe("Value is required");
	});

	it("rejects wrong length", () => {
		expect(ISBN13.validate("978030640615")).toMatch(/13 digits/);
		expect(ISBN13.validate("97803064061577")).toMatch(/13 digits/);
	});

	it("rejects non-digit characters", () => {
		expect(ISBN13.validate("978030640615X")).toMatch(/13 digits/);
	});

	it("rejects invalid checksum", () => {
		expect(ISBN13.validate("9780306406158")).toBe("Invalid ISBN-13 checksum");
	});
});

describe("AMAZON", () => {
	it("has correct name and value", () => {
		expect(AMAZON.name).toBe("AMAZON");
		expect(AMAZON.value).toBe("amazon");
	});

	it("validates correct ASIN", () => {
		expect(AMAZON.validate("B08N5WRWNW")).toBe(true);
	});

	it("validates numeric ASIN (ISBN-like)", () => {
		expect(AMAZON.validate("0306406152")).toBe(true);
	});

	it("rejects empty value", () => {
		expect(AMAZON.validate("")).toBe("Value is required");
	});

	it("rejects wrong length", () => {
		expect(AMAZON.validate("B08N5")).toMatch(/10 alphanumeric/);
	});

	it("rejects special characters", () => {
		expect(AMAZON.validate("B08N5!RWNW")).toMatch(/10 alphanumeric/);
	});
});

describe("GOOGLE", () => {
	it("has correct name and value", () => {
		expect(GOOGLE.name).toBe("GOOGLE");
		expect(GOOGLE.value).toBe("google");
	});

	it("validates correct Google Books ID", () => {
		expect(GOOGLE.validate("abc123def456")).toBe(true);
	});

	it("validates ID with hyphens and underscores", () => {
		expect(GOOGLE.validate("abc-123_def4")).toBe(true);
	});

	it("rejects empty value", () => {
		expect(GOOGLE.validate("")).toBe("Value is required");
	});

	it("rejects wrong length", () => {
		expect(GOOGLE.validate("abc123")).toMatch(/12 characters/);
	});
});

describe("GOODREADS", () => {
	it("has correct name and value", () => {
		expect(GOODREADS.name).toBe("GOODREADS");
		expect(GOODREADS.value).toBe("goodreads");
	});

	it("validates numeric ID", () => {
		expect(GOODREADS.validate("12345678")).toBe(true);
	});

	it("rejects empty value", () => {
		expect(GOODREADS.validate("")).toBe("Value is required");
	});

	it("rejects non-numeric value", () => {
		expect(GOODREADS.validate("abc123")).toMatch(/numeric/);
	});
});
