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
	getBookFileDownloadUrl(
		userId: string,
		bookId: string,
		format: BookFileFormat,
	): Promise<string>;
}
