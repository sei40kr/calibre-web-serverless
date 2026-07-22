import { bookRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { logger } from "firebase-functions/v2";
import {
	type ExtractBookMetadataParams,
	extractBookMetadata,
} from "../extractBookMetadata/usecase";

export interface ReconcileStaleProcessingBooksParams {
	// Books last touched (updatedAt) before this instant are considered stale.
	olderThan: Date;
	// When true, only report the matches; never reprocess or delete.
	dryRun: boolean;
	// Injectable so tests can assert the reprocess branch without parsing a real
	// book file. Defaults to the real extraction usecase.
	reprocess?: (params: ExtractBookMetadataParams) => Promise<void>;
}

export interface StaleBookRef {
	userId: string;
	bookId: string;
}

export interface ReconcileStaleProcessingBooksResult {
	dryRun: boolean;
	olderThan: string;
	found: number;
	reprocessed: number;
	deleted: number;
	failed: number;
	books: StaleBookRef[];
}

/**
 * Reconcile books stuck in "processing" since before `olderThan`. Each such
 * book is an upload stub whose metadata extraction never completed, handled by
 * whether its file actually made it to Storage:
 *   - file present  → the upload landed but extraction never ran (e.g. the
 *                      trigger fired before the doc existed). Re-run extraction
 *                      to recover the book rather than discard an intact upload.
 *   - file absent    → the upload never landed (an interrupted client upload).
 *                      Nothing to recover, so delete the stub (document and its
 *                      Storage folder).
 * Each book is handled best-effort: one failure is logged and counted, not
 * fatal to the rest.
 */
export async function reconcileStaleProcessingBooks({
	olderThan,
	dryRun,
	reprocess = extractBookMetadata,
}: ReconcileStaleProcessingBooksParams): Promise<ReconcileStaleProcessingBooksResult> {
	const stale = await bookRepository.findStaleProcessingBooks(olderThan);
	const books: StaleBookRef[] = stale.map((book) => ({
		userId: book.userId,
		bookId: book.id,
	}));

	if (dryRun) {
		logger.info("reconcileStaleProcessingBooks: dry run", {
			olderThan: olderThan.toISOString(),
			found: books.length,
			books,
		});
		return {
			dryRun: true,
			olderThan: olderThan.toISOString(),
			found: books.length,
			reprocessed: 0,
			deleted: 0,
			failed: 0,
			books,
		};
	}

	let reprocessed = 0;
	let deleted = 0;
	let failed = 0;
	for (const book of stale) {
		const ref: StaleBookRef = { userId: book.userId, bookId: book.id };
		try {
			const file = await bookRepository.getBookFile(
				book.userId,
				book.id,
				book.format,
			);
			if (file) {
				await reprocess({
					userId: book.userId,
					bookId: book.id,
					format: book.format,
					originalName: file.originalName,
				});
				reprocessed++;
			} else {
				await bookRepository.deleteBook(book.userId, book.id);
				deleted++;
			}
		} catch (error) {
			failed++;
			logger.error("reconcileStaleProcessingBooks: failed to reconcile book", {
				...ref,
				error,
			});
		}
	}

	logger.info("reconcileStaleProcessingBooks: complete", {
		olderThan: olderThan.toISOString(),
		found: books.length,
		reprocessed,
		deleted,
		failed,
	});
	return {
		dryRun: false,
		olderThan: olderThan.toISOString(),
		found: books.length,
		reprocessed,
		deleted,
		failed,
		books,
	};
}
