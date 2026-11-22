import { describe, expect, it } from "vitest";
import {
	locationFraction,
	type ReadingProgress,
	type ReadProgress,
	readingFraction,
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
