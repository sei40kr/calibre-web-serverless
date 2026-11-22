import {
	currentPosition,
	type ReadingProgress,
	secondsLeft,
} from "@calibre-web-serverless/domain/models/readingProgress";

/** "About 10 min left", "About 2 hr 20 min left"; never less than a minute. */
export function formatTimeLeft(seconds: number): string {
	const minutes = Math.max(1, Math.round(seconds / 60));
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `About ${minutes} min left`;
	return rest === 0
		? `About ${hours} hr left`
		: `About ${hours} hr ${rest} min left`;
}

/** The time left in a book being read, or null when there is none to show. */
export function readingTimeLeft(reading: ReadingProgress): string | null {
	if (reading.status !== "reading") return null;
	const position = currentPosition(reading);
	const seconds = position ? secondsLeft(position) : null;
	return seconds === null ? null : formatTimeLeft(seconds);
}
