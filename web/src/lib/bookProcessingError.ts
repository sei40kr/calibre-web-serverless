import type { BookProcessingErrorCode } from "@calibre-web-serverless/domain/models/bookFile";

/** User-facing message for a stored processing error code. */
export function bookProcessingErrorMessage(
	code: BookProcessingErrorCode | null,
): string {
	switch (code) {
		case "unsupported-format":
			return "This file format is not supported.";
		default:
			return "Failed to process the book file.";
	}
}
