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
import { bookRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/publisherRepository";
import { logger } from "firebase-functions/v2";
import { type ExtractedMetadata, extractMetadata } from "./extractors";

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

	try {
		const fileBuffer = await bookRepository.downloadBookFile(
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
			errorMessage: null,
		});

		logger.info(`Processed book ${bookId} for user ${userId}`, {
			title,
			format,
			hasCover,
			authorCount: entities.authorIds.length,
		});
	} catch (error) {
		logger.error("Failed to extract book metadata", { bookId, userId, error });
		await bookRepository
			.updateBook(userId, {
				...book,
				status: "error",
				errorMessage:
					error instanceof Error ? error.message : "Failed to process book",
			})
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
