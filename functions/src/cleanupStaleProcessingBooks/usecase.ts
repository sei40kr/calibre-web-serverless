import { bookRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookRepository";
import { logger } from "firebase-functions/v2";

export interface CleanupStaleProcessingBooksParams {
	// Books last touched (updatedAt) before this instant are considered stale.
	olderThan: Date;
	// When true, only report the matches; never delete.
	dryRun: boolean;
}

export interface StaleBookRef {
	userId: string;
	bookId: string;
}

export interface CleanupStaleProcessingBooksResult {
	dryRun: boolean;
	olderThan: string;
	found: number;
	deleted: number;
	failed: number;
	books: StaleBookRef[];
}

/**
 * Find and delete books stuck in "processing" since before `olderThan`. Each
 * such book is an upload stub whose metadata extraction never completed, so
 * deletion removes the Firestore document and its Storage folder with no
 * relation-count reconciliation. Deletions are best-effort per book: one
 * failure is logged and counted, not fatal to the rest.
 */
export async function cleanupStaleProcessingBooks({
	olderThan,
	dryRun,
}: CleanupStaleProcessingBooksParams): Promise<CleanupStaleProcessingBooksResult> {
	const stale = await bookRepository.findStaleProcessingBooks(olderThan);
	const books: StaleBookRef[] = stale.map((book) => ({
		userId: book.userId,
		bookId: book.id,
	}));

	if (dryRun) {
		logger.info("cleanupStaleProcessingBooks: dry run", {
			olderThan: olderThan.toISOString(),
			found: books.length,
			books,
		});
		return {
			dryRun: true,
			olderThan: olderThan.toISOString(),
			found: books.length,
			deleted: 0,
			failed: 0,
			books,
		};
	}

	let deleted = 0;
	let failed = 0;
	for (const ref of books) {
		try {
			await bookRepository.deleteBook(ref.userId, ref.bookId);
			deleted++;
		} catch (error) {
			failed++;
			logger.error("cleanupStaleProcessingBooks: failed to delete book", {
				...ref,
				error,
			});
		}
	}

	logger.info("cleanupStaleProcessingBooks: complete", {
		olderThan: olderThan.toISOString(),
		found: books.length,
		deleted,
		failed,
	});
	return {
		dryRun: false,
		olderThan: olderThan.toISOString(),
		found: books.length,
		deleted,
		failed,
		books,
	};
}
