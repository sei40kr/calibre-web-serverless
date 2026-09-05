import { bookFileRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookFileRepository";
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

export interface StaleFileRef {
	userId: string;
	bookId: string;
	format: string;
}

export interface ReconcileStaleProcessingBooksResult {
	dryRun: boolean;
	olderThan: string;
	found: number;
	reprocessed: number;
	deleted: number;
	failed: number;
	books: StaleBookRef[];
	/** Stale processing file entries found on otherwise-ready books. */
	foundFiles: number;
	filesMarkedReady: number;
	fileEntriesRemoved: number;
	files: StaleFileRef[];
}

/**
 * Reconcile the two shapes of stuck "processing" state, keyed on whether the
 * file actually made it to Storage:
 *
 * | Stuck state                          | file present   | file absent    |
 * | ------------------------------------ | -------------- | -------------- |
 * | book "processing" (upload stub)      | re-run extraction | delete stub |
 * | file entry on a ready book           | mark ready     | remove entry   |
 *
 * Best-effort: one failure is logged and counted, not fatal to the rest.
 */
export async function reconcileStaleProcessingBooks({
	olderThan,
	dryRun,
	reprocess = extractBookMetadata,
}: ReconcileStaleProcessingBooksParams): Promise<ReconcileStaleProcessingBooksResult> {
	const [stale, staleFiles] = await Promise.all([
		bookRepository.findStaleProcessingBooks(olderThan),
		bookFileRepository.findStaleProcessingFiles(olderThan),
	]);
	const books: StaleBookRef[] = stale.map((book) => ({
		userId: book.userId,
		bookId: book.id,
	}));
	const files: StaleFileRef[] = staleFiles.map(({ userId, bookId, file }) => ({
		userId,
		bookId,
		format: file.format,
	}));

	if (dryRun) {
		logger.info("reconcileStaleProcessingBooks: dry run", {
			olderThan: olderThan.toISOString(),
			found: books.length,
			books,
			foundFiles: files.length,
			files,
		});
		return {
			dryRun: true,
			olderThan: olderThan.toISOString(),
			found: books.length,
			reprocessed: 0,
			deleted: 0,
			failed: 0,
			books,
			foundFiles: files.length,
			filesMarkedReady: 0,
			fileEntriesRemoved: 0,
			files,
		};
	}

	let reprocessed = 0;
	let deleted = 0;
	let failed = 0;
	for (const book of stale) {
		const ref: StaleBookRef = { userId: book.userId, bookId: book.id };
		try {
			// A stub owns exactly one file entry; without one there is nothing
			// recoverable.
			const format = book.files[0]?.format;
			const file = format
				? await bookFileRepository.getBookFile(book.userId, book.id, format)
				: null;
			if (file && format) {
				await reprocess({
					userId: book.userId,
					bookId: book.id,
					format,
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

	let filesMarkedReady = 0;
	let fileEntriesRemoved = 0;
	for (const { userId, bookId, file } of staleFiles) {
		try {
			const stored = await bookFileRepository.getBookFile(
				userId,
				bookId,
				file.format,
			);
			if (stored) {
				await bookFileRepository.updateBookFile(userId, bookId, {
					...file,
					status: "ready",
					errorCode: null,
				});
				filesMarkedReady++;
			} else {
				await bookFileRepository.deleteBookFile(userId, bookId, file.format);
				fileEntriesRemoved++;
			}
		} catch (error) {
			failed++;
			logger.error(
				"reconcileStaleProcessingBooks: failed to reconcile file entry",
				{ userId, bookId, format: file.format, error },
			);
		}
	}

	const result: ReconcileStaleProcessingBooksResult = {
		dryRun: false,
		olderThan: olderThan.toISOString(),
		found: books.length,
		reprocessed,
		deleted,
		failed,
		books,
		foundFiles: files.length,
		filesMarkedReady,
		fileEntriesRemoved,
		files,
	};
	logger.info("reconcileStaleProcessingBooks: complete", {
		olderThan: result.olderThan,
		found: result.found,
		reprocessed,
		deleted,
		failed,
		foundFiles: result.foundFiles,
		filesMarkedReady,
		fileEntriesRemoved,
	});
	return result;
}
