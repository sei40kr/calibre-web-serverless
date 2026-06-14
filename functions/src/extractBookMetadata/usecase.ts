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
import { logger } from "firebase-functions/v2";
import { type ExtractedMetadata, extractMetadata } from "./extractors";
import { findOrCreateAuthor } from "./repositories/authorRepository";
import { uploadCover } from "./repositories/bookCoverRepository";
import {
	downloadBookFile,
	setBookError,
	updateBookMetadata,
} from "./repositories/bookRepository";
import { findOrCreatePublisher } from "./repositories/publisherRepository";

export interface ExtractBookMetadataParams {
	bucketName: string;
	userId: string;
	bookId: string;
	format: string;
	storagePath: string;
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
		const authorId = await findOrCreateAuthor(userId, authorName);
		authorIds.push(authorId);
	}

	let publisherId: string | null = null;
	if (metadata.publisher) {
		publisherId = await findOrCreatePublisher(userId, metadata.publisher);
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
	const { bucketName, userId, bookId, format, storagePath, originalName } =
		params;

	try {
		const fileBuffer = await downloadBookFile(bucketName, storagePath);
		const metadata = await extractMetadata(format, fileBuffer);

		// null when neither the file nor the filename yields a title; the
		// repository stores that as an empty title.
		const title = metadata.title ?? titleFromFilename(originalName);
		const entities = await resolveEntities(userId, metadata);

		let hasCover = false;
		if (metadata.coverImage) {
			hasCover = await uploadCover(
				bucketName,
				userId,
				bookId,
				metadata.coverImage,
			);
		}

		await updateBookMetadata(userId, bookId, {
			title,
			authorIds: entities.authorIds,
			publisherId: entities.publisherId,
			description: metadata.description,
			languages: entities.languages,
			identifiers: entities.identifiers,
			hasCover,
			pubDate: metadata.pubDate,
		});

		logger.info(`Processed book ${bookId} for user ${userId}`, {
			title,
			format,
			hasCovers: !!metadata.coverImage,
			authorCount: entities.authorIds.length,
		});
	} catch (error) {
		logger.error("Failed to extract book metadata", {
			bookId,
			userId,
			error,
		});
		await setBookError(
			userId,
			bookId,
			error instanceof Error ? error.message : "Failed to process book",
		);
	}
}
