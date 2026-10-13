import { extractCbzMetadata } from "./cbz";
import { extractEpubMetadata } from "./epub";
import { extractPdfMetadata } from "./pdf";
import type { ExtractedMetadata } from "./types";

export type { ExtractedMetadata };

/** No extractor exists for the file's format. */
export class UnsupportedBookFormatError extends Error {
	constructor(format: string) {
		super(`Unsupported book format: ${format}`);
	}
}

/**
 * Extract metadata for a given file format. Rejects for a format we have no
 * extractor for, so the caller can mark the book as failed rather than storing
 * an empty record.
 */
export function extractMetadata(
	format: string,
	data: Buffer,
): Promise<ExtractedMetadata> {
	switch (format.toLowerCase()) {
		case "epub":
			return extractEpubMetadata(data);
		case "pdf":
			return extractPdfMetadata(data);
		case "cbz":
			return extractCbzMetadata(data);
		default:
			return Promise.reject(new UnsupportedBookFormatError(format));
	}
}
