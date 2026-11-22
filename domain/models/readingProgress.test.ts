import { describe, expect, it } from "vitest";
import {
	locationFraction,
	MAX_SECONDS_PER_PAGE,
	type ReadingProgress,
	type ReadProgress,
	readingFraction,
	secondsLeft,
	unreadProgress,
	withLocation,
} from "./readingProgress";

const at = new Date("2026-11-01T10:00:00Z");

describe("withLocation", () => {
	it("starts an unread book at the location", () => {
		const reading = withLocation(
			unreadProgress,
			"pdf",
			{ pageNo: 3, pageCount: 10 },
			at,
		);
		expect(reading).toEqual({
			status: "reading",
			lastReadAt: at,
			lastFormat: "pdf",
			positions: {
				pdf: { pageNo: 3, pageCount: 10, activeSeconds: 0, unitsRead: 0 },
			},
		});
	});

	it("keeps a read book read, the pace measured there and other formats", () => {
		const read: ReadProgress = {
			status: "read",
			lastReadAt: at,
			lastFormat: "pdf",
			positions: {
				pdf: { pageNo: 9, pageCount: 10, activeSeconds: 60, unitsRead: 4 },
				cbz: { pageNo: 2, pageCount: 20, activeSeconds: 5, unitsRead: 1 },
			},
		};
		const reading = withLocation(read, "pdf", { pageNo: 4, pageCount: 10 }, at);
		expect(reading.status).toBe("read");
		expect(reading.positions.pdf).toEqual({
			pageNo: 4,
			pageCount: 10,
			activeSeconds: 60,
			unitsRead: 4,
		});
		expect(reading.positions.cbz).toEqual(read.positions.cbz);
	});
});

describe("withLocation pace", () => {
	const onPage = (pageNo: number): ReadingProgress => ({
		status: "reading",
		lastReadAt: at,
		lastFormat: "pdf",
		positions: {
			pdf: { pageNo, pageCount: 10, activeSeconds: 100, unitsRead: 2 },
		},
	});

	it("credits the time on a page when turning to the next", () => {
		const reading = withLocation(
			onPage(3),
			"pdf",
			{ pageNo: 4, pageCount: 10 },
			at,
			40,
		);
		expect(reading.positions.pdf).toMatchObject({
			activeSeconds: 140,
			unitsRead: 3,
		});
	});

	it("caps the time credited for one page", () => {
		const reading = withLocation(
			onPage(3),
			"pdf",
			{ pageNo: 4, pageCount: 10 },
			at,
			MAX_SECONDS_PER_PAGE * 3,
		);
		expect(reading.positions.pdf?.activeSeconds).toBe(
			100 + MAX_SECONDS_PER_PAGE,
		);
	});

	it("credits nothing for turning back or jumping ahead", () => {
		for (const pageNo of [2, 3, 7]) {
			const reading = withLocation(
				onPage(3),
				"pdf",
				{ pageNo, pageCount: 10 },
				at,
				40,
			);
			expect(reading.positions.pdf).toMatchObject({
				activeSeconds: 100,
				unitsRead: 2,
			});
		}
	});

	it("credits the characters of an EPUB page, across a chapter end", () => {
		const epub = (chapterNo: number, charOffset: number): ReadingProgress => ({
			status: "reading",
			lastReadAt: at,
			lastFormat: "epub",
			positions: {
				epub: {
					chapterNo,
					charOffset,
					chapterTitle: null,
					chapterLengths: [500, 500],
					activeSeconds: 0,
					unitsRead: 0,
				},
			},
		});
		const location = (chapterNo: number, charOffset: number) => ({
			chapterNo,
			charOffset,
			chapterTitle: null,
			chapterLengths: [500, 500],
		});

		expect(
			withLocation(epub(1, 100), "epub", location(1, 300), at, 30).positions
				.epub,
		).toMatchObject({ activeSeconds: 30, unitsRead: 200 });
		expect(
			withLocation(epub(1, 400), "epub", location(2, 0), at, 30).positions.epub,
		).toMatchObject({ activeSeconds: 30, unitsRead: 100 });
		expect(
			withLocation(epub(1, 400), "epub", location(2, 50), at, 30).positions
				.epub,
		).toMatchObject({ activeSeconds: 0, unitsRead: 0 });
	});
});

describe("secondsLeft", () => {
	it("extrapolates the pace over what is left", () => {
		// Pages 4-10 left at 20 seconds a page.
		expect(
			secondsLeft({
				pageNo: 4,
				pageCount: 10,
				activeSeconds: 60,
				unitsRead: 3,
			}),
		).toBe(140);
	});

	it("is null until a minute of reading is measured", () => {
		expect(
			secondsLeft({
				pageNo: 4,
				pageCount: 10,
				activeSeconds: 59,
				unitsRead: 3,
			}),
		).toBeNull();
	});
});

describe("locationFraction", () => {
	it("counts the current page as read", () => {
		expect(locationFraction({ pageNo: 1, pageCount: 4 })).toBe(0.25);
		expect(locationFraction({ pageNo: 4, pageCount: 4 })).toBe(1);
	});

	it("weights EPUB chapters by their length", () => {
		expect(
			locationFraction({
				chapterNo: 2,
				charOffset: 100,
				chapterTitle: null,
				chapterLengths: [100, 600, 300],
			}),
		).toBe(0.2);
	});

	it("is 0 for a book with no text", () => {
		expect(
			locationFraction({
				chapterNo: 1,
				charOffset: 0,
				chapterTitle: null,
				chapterLengths: [0],
			}),
		).toBe(0);
	});
});

describe("readingFraction", () => {
	const reading: ReadingProgress = {
		status: "reading",
		lastReadAt: at,
		lastFormat: "pdf",
		positions: {
			pdf: { pageNo: 5, pageCount: 10, activeSeconds: 0, unitsRead: 0 },
			cbz: { pageNo: 9, pageCount: 10, activeSeconds: 0, unitsRead: 0 },
		},
	};

	it("is null for an unread book", () => {
		expect(readingFraction(unreadProgress)).toBeNull();
	});

	it("follows the format read last", () => {
		expect(readingFraction(reading)).toBe(0.5);
	});

	it("is 1 for a read book wherever it was left", () => {
		expect(readingFraction({ ...reading, status: "read" })).toBe(1);
	});
});

describe("ReadingProgress", () => {
	it("cannot hold a state that contradicts its status", () => {
		const pdf = { pageNo: 1, pageCount: 2, activeSeconds: 0, unitsRead: 0 };
		const invalid: ReadingProgress[] = [
			// @ts-expect-error An unread book has no position.
			{ status: "unread", lastFormat: "pdf", positions: { pdf } },
			// @ts-expect-error A book being read has a position.
			{ status: "reading", lastReadAt: at, lastFormat: null, positions: {} },
			// @ts-expect-error The format read last has a position.
			{
				status: "reading",
				lastReadAt: at,
				lastFormat: "epub",
				positions: { pdf },
			},
			{
				status: "read",
				// @ts-expect-error A started book was read at some time.
				lastReadAt: null,
				lastFormat: "pdf",
				positions: { pdf },
			},
			// @ts-expect-error A book never opened has no positions.
			{ status: "read", lastReadAt: at, lastFormat: null, positions: { pdf } },
		];
		expect(invalid).toHaveLength(5);
	});

	it("rejects a contradicting state that is not an object literal", () => {
		const pdf = { pageNo: 1, pageCount: 2, activeSeconds: 0, unitsRead: 0 };
		const unreadWithPosition = {
			status: "unread" as const,
			lastFormat: "pdf" as const,
			positions: { pdf },
		};
		// @ts-expect-error An unread book has no position.
		const invalid: ReadingProgress = unreadWithPosition;
		expect(invalid.status).toBe("unread");
	});
});
