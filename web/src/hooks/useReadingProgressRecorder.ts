import {
	markedRead,
	type PositionedFormat,
	type ReadingLocation,
	type ReadingProgress,
	withLocation,
} from "@calibre-web-serverless/domain/models/readingProgress";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useCallback, useEffect, useRef } from "react";

// Page turns can come faster than Firestore's sustained rate of about one
// write per second to a document, so saves wait for the reader to settle.
export const SAVE_DELAY_MS = 3000;

// Focus is sampled rather than tracked through focus/blur events: clicking
// into the EPUB iframe blurs the window while the reader keeps focus.
const FOCUS_SAMPLE_MS = 1000;

/**
 * Returns `record`, which moves the book's reading progress to a location,
 * and `markRead`, which marks the book read and saves at once.
 * Progress is saved once no move has come for {@link SAVE_DELAY_MS}, and at
 * once when the page is hidden or the caller unmounts, so leaving the reader
 * never drops the last page. Each move passes on the time the page had focus
 * since the move before, which the pace counts. `initial` is the progress as
 * loaded; moves before it arrives are ignored.
 */
export function useReadingProgressRecorder(
	userId: string,
	bookId: string,
	initial: ReadingProgress | undefined,
) {
	// Moves build on this local copy rather than on the live book, which lags
	// behind the debounced saves.
	const readingRef = useRef<ReadingProgress | null>(null);
	if (readingRef.current === null && initial) {
		readingRef.current = initial;
	}
	const unsavedRef = useRef(false);
	const focusedMsRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const flush = useCallback(() => {
		clearTimeout(timerRef.current);
		const reading = readingRef.current;
		if (!unsavedRef.current || !reading) return;
		unsavedRef.current = false;
		bookRepository
			.updateReadingProgress(userId, bookId, reading)
			.catch((error: unknown) => {
				console.error("Failed to save reading progress", error);
			});
	}, [userId, bookId]);

	useEffect(() => {
		const id = setInterval(() => {
			if (document.visibilityState === "visible" && document.hasFocus()) {
				focusedMsRef.current += FOCUS_SAMPLE_MS;
			}
		}, FOCUS_SAMPLE_MS);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") flush();
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("pagehide", flush);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [flush]);

	const markRead = useCallback(() => {
		const reading = readingRef.current;
		if (!reading || reading.status === "read") return;
		readingRef.current = markedRead(reading, new Date());
		unsavedRef.current = true;
		flush();
	}, [flush]);

	const record = useCallback(
		(format: PositionedFormat, location: ReadingLocation) => {
			const reading = readingRef.current;
			if (!reading) return;
			readingRef.current = withLocation(
				reading,
				format,
				location,
				new Date(),
				focusedMsRef.current / 1000,
			);
			focusedMsRef.current = 0;
			unsavedRef.current = true;
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
		},
		[flush],
	);

	return { record, markRead };
}
