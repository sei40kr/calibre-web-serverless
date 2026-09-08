import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEpub } from "./epub";

async function loadFixture(name: string): Promise<ArrayBuffer> {
	const buffer = await readFile(`../fixtures/books/${name}/book.epub`);
	// Copy into this realm: jsdom tests run in their own VM context, and
	// jszip rejects an ArrayBuffer from node's realm (instanceof mismatch).
	return Uint8Array.from(buffer).buffer;
}

// jsdom's Blob lacks .text(); go through FileReader instead.
function blobText(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsText(blob);
	});
}

// jsdom has no blob URL support; capture the blobs so tests can read back
// what each issued URL points to.
let blobsByUrl: Map<string, Blob>;

beforeEach(() => {
	blobsByUrl = new Map();
	let nextId = 0;
	URL.createObjectURL = vi.fn((blob: Blob) => {
		const url = `blob:test-${nextId++}`;
		blobsByUrl.set(url, blob);
		return url;
	});
	URL.revokeObjectURL = vi.fn((url: string) => {
		blobsByUrl.delete(url);
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("openEpub", () => {
	it("reads the rtl page progression of a vertical-writing book", async () => {
		const book = await openEpub(await loadFixture("rashomon"));
		expect(book.pageProgression).toBe("rtl");
		expect(book.chapterCount).toBe(3);
	});

	it("defaults to ltr page progression", async () => {
		const book = await openEpub(await loadFixture("wagahai-wa-neko-de-aru"));
		expect(book.pageProgression).toBe("ltr");
		expect(book.chapterCount).toBe(5);
	});

	it("rewrites stylesheet links to blob URLs, following @imports", async () => {
		const book = await openEpub(await loadFixture("rashomon"));
		const html = await book.loadChapter(1);

		expect(html).toContain("羅生門");
		const [, styleUrl] = html.match(/href="(blob:[^"]+)"/) ?? [];
		expect(styleUrl).toBeDefined();

		// book-style.css only @imports the actual stylesheets; each import must
		// itself have been rewritten to a blob URL for the page to be styled.
		const styleBlob = blobsByUrl.get(styleUrl as string);
		expect(styleBlob).toBeDefined();
		const css = await blobText(styleBlob as Blob);
		expect(css).toContain('@import "blob:');
		// style-standard.css is one of its imports; a commented-out import of a
		// file absent from the zip is the only .css reference allowed to remain.
		expect(css).not.toContain("style-standard.css");
	});

	it("revokes every issued blob URL on dispose", async () => {
		const book = await openEpub(await loadFixture("rashomon"));
		await book.loadChapter(1);
		expect(blobsByUrl.size).toBeGreaterThan(0);
		book.dispose();
		expect(blobsByUrl.size).toBe(0);
	});
});
