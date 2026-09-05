import type { BookFileErrorCode } from "@calibre-web-serverless/domain/errors/bookFileError";
import type { StorageErrorCode } from "@calibre-web-serverless/domain/errors/storageError";
import type { BookProcessingErrorCode } from "@calibre-web-serverless/domain/models/bookFile";

/**
 * Lifecycle of one queued book upload: waiting for a transfer slot, sending
 * bytes to Storage, waiting for metadata extraction, then a terminal state.
 */
export type BookUploadStatus =
	| "queued"
	| "uploading"
	| "processing"
	| "ready"
	| "error";

/**
 * Why an upload ended in "error". Codes only — the presentation layer maps
 * them to user-facing text.
 */
export type BookUploadFailure =
	| { kind: "file"; code: BookFileErrorCode }
	| { kind: "storage"; code: StorageErrorCode }
	| { kind: "processing"; code: BookProcessingErrorCode | null }
	| { kind: "processing-timeout" }
	| { kind: "unknown"; message: string };

export interface BookUpload {
	id: string;
	fileName: string;
	fileSize: number;
	bytesTransferred: number;
	status: BookUploadStatus;
	/** Set once the book document exists. */
	bookId: string | null;
	/** The extracted title, known once processing finishes. */
	title: string | null;
	failure: BookUploadFailure | null;
}

/** Whether the upload still has work in flight (transfer or processing). */
export function isBookUploadActive(upload: BookUpload): boolean {
	return (
		upload.status === "queued" ||
		upload.status === "uploading" ||
		upload.status === "processing"
	);
}

export function isBookUploadFinished(upload: BookUpload): boolean {
	return !isBookUploadActive(upload);
}

/** Transfer progress as a percentage in [0, 100]. */
export function bookUploadPercent(upload: BookUpload): number {
	if (upload.fileSize <= 0) return 0;
	return Math.min(
		100,
		Math.round((upload.bytesTransferred / upload.fileSize) * 100),
	);
}

/** User-facing message for a failed upload. */
export function bookUploadFailureMessage(failure: BookUploadFailure): string {
	switch (failure.kind) {
		case "file":
			return failure.code === "unsupported-format"
				? "Unsupported file format"
				: `Upload failed: ${failure.code}`;
		case "storage":
			switch (failure.code) {
				case "unauthorized":
					return "You don't have permission to upload files";
				case "canceled":
					return "Upload was cancelled";
				case "stalled":
					return "Upload stalled — check your connection and try again.";
				case "quota-exceeded":
					return "Storage quota exceeded";
				default:
					return `Upload failed: ${failure.code}`;
			}
		case "processing":
			return failure.code === "unsupported-format"
				? "This file format is not supported."
				: "Failed to process the book file.";
		case "processing-timeout":
			return "Processing timed out. The book may still be processing in the background.";
		case "unknown":
			return `Unexpected error: ${failure.message}`;
	}
}
