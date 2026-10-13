import { describe, expect, it } from "vitest";
import { comicPagePaths, comicSpreads } from "./comicArchive";

describe("comicPagePaths", () => {
	it("sorts page images naturally", () => {
		expect(comicPagePaths(["10.jpg", "2.jpg", "1.png"])).toEqual([
			"1.png",
			"2.jpg",
			"10.jpg",
		]);
	});

	it("drops non-images, directories, hidden files and resource forks", () => {
		expect(
			comicPagePaths([
				"ComicInfo.xml",
				"pages/",
				"pages/01.JPG",
				"pages/.DS_Store",
				"pages/._01.jpg",
				"__MACOSX/pages/._01.jpg",
			]),
		).toEqual(["pages/01.JPG"]);
	});
});

describe("comicSpreads", () => {
	it("shows the cover alone and pairs the rest", () => {
		expect(comicSpreads([false, false, false, false])).toEqual([
			[0],
			[1, 2],
			[3],
		]);
	});

	it("shows wide pages alone and restarts pairing after them", () => {
		expect(
			comicSpreads([false, false, false, false, false, true, false, false]),
		).toEqual([[0], [1, 2], [3, 4], [5], [6, 7]]);
		expect(comicSpreads([false, false, true, false, false])).toEqual([
			[0],
			[1],
			[2],
			[3, 4],
		]);
	});

	it("handles an empty archive", () => {
		expect(comicSpreads([])).toEqual([]);
	});
});
