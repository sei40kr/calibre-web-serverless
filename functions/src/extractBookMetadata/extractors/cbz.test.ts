import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractCbzMetadata } from "./cbz";

const FIXTURES_DIR = resolve(__dirname, "../../../../fixtures/books");

async function buildCbz(files: Record<string, string>): Promise<Buffer> {
	const zip = new JSZip();
	for (const [name, content] of Object.entries(files)) {
		zip.file(name, content);
	}
	return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("extractCbzMetadata", () => {
	it("reads ComicInfo.xml and the first page of a real comic", async () => {
		const data = await readFile(
			resolve(FIXTURES_DIR, "joe-louis-champion-of-champions/book.cbz"),
		);
		const metadata = await extractCbzMetadata(data);

		expect(metadata).toMatchObject({
			title: "Joe Louis, Champion of Champions #2",
			authors: [],
			language: "en",
			publisher: "Fawcett Publications",
			pubDate: new Date(Date.UTC(1950, 10, 1)),
			series: { name: "Joe Louis, Champion of Champions", index: 2 },
		});
		const zip = await JSZip.loadAsync(data);
		expect(metadata.coverImage).toEqual(
			await zip.file("p-01.jpg")!.async("nodebuffer"),
		);
	});

	it("falls back to empty metadata without ComicInfo.xml", async () => {
		const metadata = await extractCbzMetadata(
			await buildCbz({ "10.jpg": "ten", "2.jpg": "two" }),
		);

		expect(metadata).toMatchObject({
			title: null,
			authors: [],
			series: null,
		});
		expect(metadata.coverImage?.toString()).toBe("two");
	});

	it("splits Writer into authors and defaults a missing volume number to 1", async () => {
		const metadata = await extractCbzMetadata(
			await buildCbz({
				"1.jpg": "one",
				"ComicInfo.xml":
					"<ComicInfo><Series>S</Series><Writer>A, B</Writer></ComicInfo>",
			}),
		);

		expect(metadata.authors).toEqual(["A", "B"]);
		expect(metadata.series).toEqual({ name: "S", index: 1 });
	});

	it("rejects an archive without page images", async () => {
		await expect(
			extractCbzMetadata(await buildCbz({ "readme.txt": "" })),
		).rejects.toThrow("no page images");
	});
});
