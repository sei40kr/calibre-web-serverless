import { describe, expect, it } from "vitest";
import { isRightToLeft } from "./comic";

const comicInfo = (manga: string) =>
	`<?xml version="1.0"?><ComicInfo><Manga>${manga}</Manga></ComicInfo>`;

describe("isRightToLeft", () => {
	it("defaults to right to left without ComicInfo.xml or a Manga field", () => {
		expect(isRightToLeft(null)).toBe(true);
		expect(isRightToLeft("<ComicInfo><Title>T</Title></ComicInfo>")).toBe(true);
		expect(isRightToLeft(comicInfo("Unknown"))).toBe(true);
	});

	it("follows an explicit Manga value", () => {
		expect(isRightToLeft(comicInfo("YesAndRightToLeft"))).toBe(true);
		expect(isRightToLeft(comicInfo("Yes"))).toBe(true);
		expect(isRightToLeft(comicInfo("No"))).toBe(false);
	});
});
