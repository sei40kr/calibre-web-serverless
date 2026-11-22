import {
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

/**
 * Returns a function that moves the book's reading progress to a location.
 * Progress is saved once no move has come for {@link SAVE_DELAY_MS}, and at
 * once when the page is hidden or the caller unmounts, so leaving the reader
 * never drops the last page. `initial` is the progress as loaded; moves before
 * it arrives are ignored.
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

	return useCallback(
		(format: PositionedFormat, location: ReadingLocation) => {
			const reading = readingRef.current;
			if (!reading) return;
			readingRef.current = withLocation(reading, format, location, new Date());
			unsavedRef.current = true;
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
		},
		[flush],
	);
}
