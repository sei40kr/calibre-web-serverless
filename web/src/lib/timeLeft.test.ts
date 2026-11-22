import { unreadProgress } from "@calibre-web-serverless/domain/models/readingProgress";
import { describe, expect, it } from "vitest";
import { formatTimeLeft, readingTimeLeft } from "./timeLeft";

describe("formatTimeLeft", () => {
	it("rounds to whole minutes, at least one", () => {
		expect(formatTimeLeft(5)).toBe("About 1 min left");
		expect(formatTimeLeft(10 * 60 + 20)).toBe("About 10 min left");
	});

	it("splits hours from minutes", () => {
		expect(formatTimeLeft(60 * 60)).toBe("About 1 hr left");
		expect(formatTimeLeft(140 * 60)).toBe("About 2 hr 20 min left");
	});
});

describe("readingTimeLeft", () => {
	const reading = {
		status: "reading" as const,
		lastReadAt: new Date("2026-11-01T10:00:00Z"),
		lastFormat: "pdf" as const,
		positions: {
			pdf: { pageNo: 4, pageCount: 10, activeSeconds: 600, unitsRead: 3 },
		},
	};

	it("estimates the format read last", () => {
		// 7 pages at 200 seconds a page.
		expect(readingTimeLeft(reading)).toBe("About 23 min left");
	});

	it("shows nothing for unread or read books", () => {
		expect(readingTimeLeft(unreadProgress)).toBeNull();
		expect(readingTimeLeft({ ...reading, status: "read" })).toBeNull();
	});
});
