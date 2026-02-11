import { extractEpubMetadata } from "./epub";
import { extractPdfMetadata } from "./pdf";
import type { ExtractedMetadata } from "./types";

export type { ExtractedMetadata };

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
		default:
			return Promise.reject(new Error(`Unsupported book format: ${format}`));
	}
}
