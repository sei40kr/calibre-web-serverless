import { unreadProgress } from "@calibre-web-serverless/domain/models/readingProgress";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	SAVE_DELAY_MS,
	useReadingProgressRecorder,
} from "./useReadingProgressRecorder";

vi.mock(
	"@calibre-web-serverless/infrastructure/repositories/bookRepository",
	() => ({
		bookRepository: { updateReadingProgress: vi.fn(() => Promise.resolve()) },
	}),
);

const save = vi.mocked(bookRepository.updateReadingProgress);

const render = () =>
	renderHook(() =>
		useReadingProgressRecorder("user-1", "book-1", unreadProgress),
	);

describe("useReadingProgressRecorder", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		save.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("saves once, with the last location, after moves settle", () => {
		const { result } = render();

		act(() => {
			result.current("pdf", { pageNo: 2, pageCount: 10 });
			vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
			result.current("pdf", { pageNo: 3, pageCount: 10 });
			vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
		});
		expect(save).not.toHaveBeenCalled();

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(save).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledWith(
			"user-1",
			"book-1",
			expect.objectContaining({
				status: "reading",
				lastFormat: "pdf",
				positions: {
					pdf: expect.objectContaining({ pageNo: 3, pageCount: 10 }),
				},
			}),
		);
	});

	it("counts only focused time toward the pace", () => {
		const { result } = render();
		const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);

		act(() => {
			result.current("pdf", { pageNo: 2, pageCount: 10 });
			vi.advanceTimersByTime(20_000);
			hasFocus.mockReturnValue(false);
			vi.advanceTimersByTime(60_000);
			result.current("pdf", { pageNo: 3, pageCount: 10 });
			vi.advanceTimersByTime(SAVE_DELAY_MS);
		});

		expect(save).toHaveBeenLastCalledWith(
			"user-1",
			"book-1",
			expect.objectContaining({
				positions: {
					pdf: { pageNo: 3, pageCount: 10, activeSeconds: 20, unitsRead: 1 },
				},
			}),
		);
	});

	it("saves at once when the page is hidden", () => {
		const { result } = render();
		act(() => result.current("pdf", { pageNo: 2, pageCount: 10 }));

		vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
		document.dispatchEvent(new Event("visibilitychange"));

		expect(save).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(SAVE_DELAY_MS);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("saves at once on unmount, and not at all without a move", () => {
		const idle = render();
		idle.unmount();
		expect(save).not.toHaveBeenCalled();

		const { result, unmount } = render();
		act(() => result.current("pdf", { pageNo: 2, pageCount: 10 }));
		unmount();
		expect(save).toHaveBeenCalledTimes(1);
	});
});
