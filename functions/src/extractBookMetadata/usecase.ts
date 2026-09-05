import type { BookProcessingErrorCode } from "@calibre-web-serverless/domain/models/bookFile";
import {
	AMAZON,
	GOODREADS,
	GOOGLE,
	type Identifier,
	type IdentifierType,
	ISBN,
	ISBN13,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import { authorRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/authorRepository";
import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookCoverRepository";
import { bookFileRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookFileRepository";
import { bookRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/publisherRepository";
import { logger } from "firebase-functions/v2";
import {
	type ExtractedMetadata,
	extractMetadata,
	UnsupportedBookFormatError,
} from "./extractors";

export interface ExtractBookMetadataParams {
	userId: string;
	bookId: string;
	format: string;
	/** Original upload filename, used as a fallback title source. */
	originalName?: string;
}

export function titleFromFilename(originalName?: string): string | null {
	if (!originalName) return null;
	const base = originalName.replace(/\.[^/.]+$/, "");
	return base.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim() || null;
}

// Maps the various identifier scheme strings extractors emit (URN schemes,
// EPUB scheme attributes, XMP prefixes) directly to their domain type.
const identifierTypesByCode: Record<string, IdentifierType> = {
	isbn: ISBN,
	isbn10: ISBN,
	"isbn-10": ISBN,
	isbn13: ISBN13,
	"isbn-13": ISBN13,
	amazon: AMAZON,
	asin: AMAZON,
	google: GOOGLE,
	goodreads: GOODREADS,
};

export function resolveIdentifierType(type: string): IdentifierType | null {
	return identifierTypesByCode[type.toLowerCase()] ?? null;
}

export function resolveLanguage(code: string): Language | null {
	return Language.from(code.substring(0, 2).toLowerCase()) ?? null;
}

async function resolveEntities(
	userId: string,
	metadata: ExtractedMetadata,
): Promise<{
	authorIds: string[];
	publisherId: string | null;
	identifiers: Identifier[];
	languages: Language[];
}> {
	const authorIds: string[] = [];
	for (const authorName of metadata.authors) {
		authorIds.push(
			await authorRepository.findOrCreateAuthor(userId, authorName),
		);
	}

	let publisherId: string | null = null;
	if (metadata.publisher) {
		publisherId = await publisherRepository.findOrCreatePublisher(
			userId,
			metadata.publisher,
		);
	}

	const identifiers = metadata.identifiers
		.map(({ type, value }): Identifier | null => {
			const identifierType = resolveIdentifierType(type);
			return identifierType ? { type: identifierType, value } : null;
		})
		.filter((id): id is Identifier => id !== null);

	const languages: Language[] = [];
	if (metadata.language) {
		const language = resolveLanguage(metadata.language);
		if (language) languages.push(language);
	}

	return { authorIds, publisherId, identifiers, languages };
}

export async function extractBookMetadata(
	params: ExtractBookMetadataParams,
): Promise<void> {
	const { userId, bookId, format, originalName } = params;

	const book = await bookRepository.getBook(userId, bookId);
	if (!book) {
		logger.warn("Book not found for extraction", { userId, bookId });
		return;
	}
	// An object written to Storage without a registered entry (outside the
	// client flow) is ignored.
	const bookFile = book.files.find((f) => f.format === format);
	if (!bookFile) {
		logger.warn("No file entry for uploaded object", {
			userId,
			bookId,
			format,
		});
		return;
	}

	// An additional format on an already-ready book: extraction is skipped so
	// it can never clobber the (possibly user-edited) existing metadata.
	if (book.status === "ready") {
		await bookFileRepository.updateBookFile(userId, bookId, {
			...bookFile,
			status: "ready",
			errorCode: null,
		});
		logger.info(`Registered additional ${format} file for book ${bookId}`, {
			userId,
		});
		return;
	}

	try {
		const fileBuffer = await bookFileRepository.downloadBookFile(
			userId,
			bookId,
			format,
		);
		const metadata = await extractMetadata(format, fileBuffer);

		// null when neither the file nor the filename yields a title; stored as "".
		const title = metadata.title ?? titleFromFilename(originalName);
		const entities = await resolveEntities(userId, metadata);

		const hasCover = metadata.coverImage
			? await bookCoverRepository.saveExtractedCover(
					userId,
					bookId,
					metadata.coverImage,
				)
			: false;

		// Mark the file ready before flipping the book: a crash in between
		// leaves the book "processing" with its file present, which the
		// reconcile job resolves by re-running extraction.
		await bookFileRepository.updateBookFile(userId, bookId, {
			...bookFile,
			status: "ready",
			errorCode: null,
		});
		await bookRepository.updateBook(userId, {
			...book,
			title: title ?? "",
			authorIds: entities.authorIds,
			publisherId: entities.publisherId,
			description: metadata.description,
			languages: entities.languages,
			identifiers: entities.identifiers,
			hasCover,
			pubDate: metadata.pubDate,
			status: "ready",
			errorCode: null,
		});

		logger.info(`Processed book ${bookId} for user ${userId}`, {
			title,
			format,
			hasCover,
			authorCount: entities.authorIds.length,
		});
	} catch (error) {
		// The raw error stays in the logs; the model only stores a code.
		logger.error("Failed to extract book metadata", { bookId, userId, error });
		const errorCode: BookProcessingErrorCode =
			error instanceof UnsupportedBookFormatError
				? "unsupported-format"
				: "extraction-failed";
		await bookFileRepository
			.updateBookFile(userId, bookId, {
				...bookFile,
				status: "error",
				errorCode,
			})
			.then(() =>
				bookRepository.updateBook(userId, {
					...book,
					status: "error",
					errorCode,
				}),
			)
			.catch((err) => {
				// The book doc may have been deleted before processing finished.
				logger.warn("Failed to record book error status", {
					userId,
					bookId,
					err,
				});
			});
	}
}
