import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import { extractEpubMetadata } from "./epub";
import type { ExtractedMetadata } from "./types";

const FIXTURES_DIR = resolve(__dirname, "../../../../fixtures/books");

function loadFixture(book: string): Promise<ExtractedMetadata> {
	return readFile(resolve(FIXTURES_DIR, book, "book.epub")).then(
		extractEpubMetadata,
	);
}

describe("extractEpubMetadata", () => {
	// A real Project Gutenberg EPUB (Alice, #11). Its description, publisher and
	// a typed ISBN identifier were added to the OPF so a single real fixture
	// exercises every metadata field the extractor reads.
	describe("alice-in-wonderland (real EPUB)", () => {
		let metadata: ExtractedMetadata;
		beforeAll(async () => {
			metadata = await loadFixture("alice-in-wonderland");
		});

		it("extracts title", () => {
			expect(metadata.title).toBe("Alice's Adventures in Wonderland");
		});

		it("extracts authors", () => {
			expect(metadata.authors).toEqual(["Lewis Carroll"]);
		});

		it("extracts language", () => {
			expect(metadata.language).toBe("en");
		});

		it("extracts pubDate", () => {
			expect(metadata.pubDate).toEqual(new Date("2008-06-27"));
		});

		it("extracts description", () => {
			expect(metadata.description).toBe(
				"A young girl falls down a rabbit hole into a fantasy world.",
			);
		});

		it("extracts publisher", () => {
			expect(metadata.publisher).toBe("Project Gutenberg");
		});

		it("extracts typed identifiers (dc:identifier with opf:scheme)", () => {
			expect(metadata.identifiers).toEqual([
				{ type: "isbn", value: "9783161484100" },
			]);
		});

		it("extracts cover image", () => {
			expect(metadata.coverImage).toBeInstanceOf(Buffer);
			expect(metadata.coverImage?.length).toBeGreaterThan(0);
		});
	});

	// A real Japanese EPUB, for multibyte title/author handling and the
	// no-embedded-cover path.
	describe("rashomon (real EPUB, Japanese)", () => {
		let metadata: ExtractedMetadata;
		beforeAll(async () => {
			metadata = await loadFixture("rashomon");
		});

		it("extracts Japanese title", () => {
			expect(metadata.title).toBe("羅生門");
		});

		it("extracts Japanese author", () => {
			expect(metadata.authors).toEqual(["芥川龍之介"]);
		});

		it("extracts language", () => {
			expect(metadata.language).toBe("ja");
		});

		it("has null coverImage (no embedded cover)", () => {
			expect(metadata.coverImage).toBeNull();
		});
	});

	describe('EPUB 3 cover (properties="cover-image")', () => {
		async function buildEpub3WithCover(): Promise<Buffer> {
			const zip = new JSZip();
			zip.file("mimetype", "application/epub+zip");
			zip.file(
				"META-INF/container.xml",
				`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
			);
			zip.file(
				"OEBPS/content.opf",
				`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>EPUB3 Cover Book</dc:title>
  </metadata>
  <manifest>
    <item id="cover-img" href="images/cover.png" media-type="image/png" properties="cover-image"/>
  </manifest>
  <spine/>
</package>`,
			);
			zip.file("OEBPS/images/cover.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
			return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
		}

		it("extracts the cover image from a manifest item with cover-image properties", async () => {
			const data = await buildEpub3WithCover();
			const metadata = await extractEpubMetadata(data);
			expect(metadata.coverImage).toBeInstanceOf(Buffer);
			expect(metadata.coverImage?.length).toBeGreaterThan(0);
		});
	});

	describe("error cases", () => {
		it("throws on invalid buffer (not a ZIP)", async () => {
			const invalidBuffer = Buffer.from("not a zip file");
			await expect(extractEpubMetadata(invalidBuffer)).rejects.toThrow();
		});

		it("throws on ZIP without container.xml", async () => {
			const zip = new JSZip();
			zip.file("random.txt", "hello");
			const buf = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
			await expect(extractEpubMetadata(buf)).rejects.toThrow(
				"missing container.xml",
			);
		});
	});
});
