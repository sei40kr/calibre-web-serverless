import type { BookFileFormat } from "../models/bookFile";

export interface BookFileRepository {
	/** Add a new format to an existing, ready book by uploading its file. */
	addBookFile(params: {
		userId: string;
		bookId: string;
		file: File;
	}): Promise<{ format: BookFileFormat }>;
	/** Remove one format of a book. The last remaining file cannot be removed. */
	deleteBookFile(
		userId: string,
		bookId: string,
		format: BookFileFormat,
	): Promise<void>;
	/**
	 * Resolves a URL the book's stored file can be read from.
	 *
	 * The caller owns the URL: the web implementation returns an object URL,
	 * which must be released with `URL.revokeObjectURL` once the reader is done
	 * with it.
	 */
	getBookFileDownloadUrl(
		userId: string,
		bookId: string,
		format: BookFileFormat,
	): Promise<string>;
}
