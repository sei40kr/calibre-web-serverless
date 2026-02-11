import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractPdfMetadata } from "./pdf";

const FIXTURES_DIR = resolve(__dirname, "../../../../fixtures/books");

// A real PDF (Alice, converted from the EPUB fixture by Calibre, carrying a
// plain Info dict and an XMP packet) is the base for every case below.
// Variations are crafted by swapping its metadata so tests exercise the parser
// with controlled data on a realistic PDF container.
const BASE_PDF = readFileSync(
	resolve(FIXTURES_DIR, "alice-in-wonderland", "book.pdf"),
);
const BASE_TEXT = BASE_PDF.toString("latin1");

interface CraftOptions {
	/** Body of the trailer's /Info object (object 1); omitted leaves it empty. */
	info?: string;
	/** rdf:Description element(s) for the XMP packet; omitted removes XMP. */
	xmp?: string;
	/** Info-dict body to embed only inside a FlateDecode stream. */
	compressed?: string;
}

/** Craft a PDF variation from the base file by replacing its metadata. */
function craft({ info, xmp, compressed }: CraftOptions): Buffer {
	const text = BASE_TEXT
		// Replace the /Info object (object 1) dictionary body.
		.replace(/(\b1 0 obj\s*<<)[\s\S]*?(>>\s*endobj)/, `$1 ${info ?? ""} $2`)
		// Replace or drop the XMP packet.
		.replace(
			/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/,
			xmp
				? `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${xmp}</rdf:RDF></x:xmpmeta>`
				: "",
		);

	let buf = Buffer.from(text, "latin1");
	if (compressed) {
		const deflated = deflateSync(Buffer.from(`<< ${compressed} >>`, "latin1"));
		buf = Buffer.concat([
			buf,
			Buffer.from(
				`\n99 0 obj\n<< /Filter /FlateDecode /Length ${deflated.length} >>\nstream\n`,
				"latin1",
			),
			deflated,
			Buffer.from("\nendstream\nendobj\n", "latin1"),
		]);
	}
	return buf;
}

const encodeUtf16Hex = (s: string) =>
	`FEFF${Array.from(s)
		.map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
		.join("")}`;

const encodeHex = (s: string) =>
	Array.from(s)
		.map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
		.join("");

describe("extractPdfMetadata", () => {
	describe("converted PDF (base file, unmodified)", () => {
		it("extracts title, author, description, publisher and language", async () => {
			const metadata = await extractPdfMetadata(BASE_PDF);
			expect(metadata.title).toBe("Alice's Adventures in Wonderland");
			expect(metadata.authors).toEqual(["Lewis Carroll"]);
			expect(metadata.description).toBe(
				"A young girl falls down a rabbit hole into a fantasy world.",
			);
			expect(metadata.publisher).toBe("Project Gutenberg");
			expect(metadata.language).toBe("en");
		});
	});

	describe("Info dictionary", () => {
		it("extracts title, author, publisher and pubDate from paren strings", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					info: "/Title (My Book) /Author (Jane Doe) /Publisher (Acme Press) /CreationDate (D:20230615)",
				}),
			);
			expect(metadata.title).toBe("My Book");
			expect(metadata.authors).toEqual(["Jane Doe"]);
			expect(metadata.publisher).toBe("Acme Press");
			expect(metadata.pubDate).toEqual(new Date("2023-06-15"));
		});

		it("decodes escape sequences in paren strings", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: "/Title (Line1\\nLine2)" }),
			);
			expect(metadata.title).toBe("Line1\nLine2");
		});

		it("handles escaped parentheses inside paren strings", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: "/Author (Georges Bizet \\(1838-1875\\))" }),
			);
			expect(metadata.authors).toEqual(["Georges Bizet (1838-1875)"]);
		});

		it("decodes UTF-16BE hex strings", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					info: `/Title <${encodeUtf16Hex("Hello World")}> /Author <${encodeUtf16Hex("Author Name")}>`,
				}),
			);
			expect(metadata.title).toBe("Hello World");
			expect(metadata.authors).toEqual(["Author Name"]);
		});

		it("decodes plain hex strings (no BOM)", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: `/Title <${encodeHex("Plain Hex")}>` }),
			);
			expect(metadata.title).toBe("Plain Hex");
		});

		it("returns null for an empty paren string", async () => {
			const metadata = await extractPdfMetadata(craft({ info: "/Title ()" }));
			expect(metadata.title).toBeNull();
		});

		it("returns null for an empty hex string", async () => {
			const metadata = await extractPdfMetadata(craft({ info: "/Title <>" }));
			expect(metadata.title).toBeNull();
		});
	});

	describe("CreationDate parsing", () => {
		it("parses D:YYYYMMDD format", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: "/CreationDate (D:20231225)" }),
			);
			expect(metadata.pubDate).toEqual(new Date("2023-12-25"));
		});

		it("parses D:YYYY format (month/day default to 01)", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: "/CreationDate (D:2020)" }),
			);
			expect(metadata.pubDate).toEqual(new Date("2020-01-01"));
		});

		it("parses a date with timezone suffix", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: "/CreationDate (D:20100907043045-07'00')" }),
			);
			expect(metadata.pubDate).toEqual(new Date("2010-09-07"));
		});

		it("returns null pubDate when there is no CreationDate", async () => {
			const metadata = await extractPdfMetadata(
				craft({ info: "/Title (No Date)" }),
			);
			expect(metadata.pubDate).toBeNull();
		});
	});

	describe("compressed object stream (FlateDecode)", () => {
		it("extracts metadata embedded only inside a compressed stream", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					compressed:
						"/Title (Compressed Title) /Author (Compressed Author) /Publisher (Compressed Press) /CreationDate (D:20120304)",
				}),
			);
			expect(metadata.title).toBe("Compressed Title");
			expect(metadata.authors).toEqual(["Compressed Author"]);
			expect(metadata.publisher).toBe("Compressed Press");
			expect(metadata.pubDate).toEqual(new Date("2012-03-04"));
		});
	});

	describe("XMP metadata", () => {
		const dcNs =
			'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/"';

		it("extracts title, author, publisher, description and language", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					xmp: `<rdf:Description ${dcNs}>
						<dc:title><rdf:Alt><rdf:li xml:lang="x-default">XMP Title</rdf:li></rdf:Alt></dc:title>
						<dc:creator><rdf:Seq><rdf:li>XMP Author</rdf:li></rdf:Seq></dc:creator>
						<dc:publisher><rdf:Bag><rdf:li>XMP Press</rdf:li></rdf:Bag></dc:publisher>
						<dc:description><rdf:Alt><rdf:li xml:lang="x-default">A description from XMP.</rdf:li></rdf:Alt></dc:description>
						<dc:language><rdf:Bag><rdf:li>fr</rdf:li></rdf:Bag></dc:language>
						<xmp:CreateDate>2010-10-27T00:00:00Z</xmp:CreateDate>
					</rdf:Description>`,
				}),
			);
			expect(metadata.title).toBe("XMP Title");
			expect(metadata.authors).toEqual(["XMP Author"]);
			expect(metadata.publisher).toBe("XMP Press");
			expect(metadata.description).toBe("A description from XMP.");
			expect(metadata.language).toBe("fr");
			expect(metadata.pubDate).toEqual(new Date("2010-10-27"));
		});

		it("merges properties split across multiple rdf:Description elements", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					xmp: `<rdf:Description ${dcNs}><dc:title><rdf:Alt><rdf:li>Split Title</rdf:li></rdf:Alt></dc:title></rdf:Description>
						<rdf:Description ${dcNs}><dc:creator><rdf:Seq><rdf:li>Split Author</rdf:li></rdf:Seq></dc:creator></rdf:Description>`,
				}),
			);
			expect(metadata.title).toBe("Split Title");
			expect(metadata.authors).toEqual(["Split Author"]);
		});

		it("extracts multiple authors from dc:creator", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					xmp: `<rdf:Description ${dcNs}><dc:creator><rdf:Seq><rdf:li>First Author</rdf:li><rdf:li>Second Author</rdf:li></rdf:Seq></dc:creator></rdf:Description>`,
				}),
			);
			expect(metadata.authors).toEqual(["First Author", "Second Author"]);
		});

		it("extracts typed identifiers from dc:identifier", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					xmp: `<rdf:Description ${dcNs}><dc:identifier><rdf:Bag><rdf:li>urn:isbn:9780000000001</rdf:li><rdf:li>amazon:B000000000</rdf:li></rdf:Bag></dc:identifier></rdf:Description>`,
				}),
			);
			expect(metadata.identifiers).toEqual([
				{ type: "isbn", value: "9780000000001" },
				{ type: "amazon", value: "B000000000" },
			]);
		});

		it("drops a bare identifier that has no recognizable scheme", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					xmp: `<rdf:Description ${dcNs}><dc:identifier>9780000000001</dc:identifier></rdf:Description>`,
				}),
			);
			expect(metadata.identifiers).toEqual([]);
		});
	});

	describe("merge priority (Info dict > XMP)", () => {
		it("prefers the Info dict for title/author while XMP fills the gaps", async () => {
			const metadata = await extractPdfMetadata(
				craft({
					info: "/Title (Info Dict Title) /Author (Info Dict Author)",
					xmp: `<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">
						<dc:title><rdf:Alt><rdf:li>XMP Title</rdf:li></rdf:Alt></dc:title>
						<dc:creator><rdf:Seq><rdf:li>XMP Author</rdf:li></rdf:Seq></dc:creator>
						<dc:description><rdf:Alt><rdf:li>A description from XMP.</rdf:li></rdf:Alt></dc:description>
						<dc:language><rdf:Bag><rdf:li>fr</rdf:li></rdf:Bag></dc:language>
					</rdf:Description>`,
				}),
			);
			expect(metadata.title).toBe("Info Dict Title");
			expect(metadata.authors).toEqual(["Info Dict Author"]);
			expect(metadata.description).toBe("A description from XMP.");
			expect(metadata.language).toBe("fr");
		});
	});

	describe("robustness", () => {
		it("returns empty metadata for a minimal PDF with no metadata", async () => {
			const metadata = await extractPdfMetadata(Buffer.from("%PDF-1.4\n"));
			expect(metadata.title).toBeNull();
			expect(metadata.authors).toEqual([]);
			expect(metadata.description).toBeNull();
			expect(metadata.language).toBeNull();
			expect(metadata.publisher).toBeNull();
			expect(metadata.pubDate).toBeNull();
			expect(metadata.identifiers).toEqual([]);
			expect(metadata.coverImage).toBeNull();
		});

		it("returns empty metadata for an empty buffer without throwing", async () => {
			const metadata = await extractPdfMetadata(Buffer.alloc(0));
			expect(metadata.title).toBeNull();
			expect(metadata.authors).toEqual([]);
		});

		it("does not crash on binary garbage", async () => {
			const garbage = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
			const metadata = await extractPdfMetadata(garbage);
			expect(metadata.title).toBeNull();
			expect(metadata.authors).toEqual([]);
		});

		it("does not crash on malformed XMP XML", async () => {
			const pdf = Buffer.from(
				`%PDF-1.4\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><broken><not-closed></x:xmpmeta>\n`,
				"latin1",
			);
			const metadata = await extractPdfMetadata(pdf);
			expect(metadata.title).toBeNull();
			expect(metadata.authors).toEqual([]);
		});
	});
});
