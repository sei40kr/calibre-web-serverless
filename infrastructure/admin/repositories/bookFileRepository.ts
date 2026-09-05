import type { BookFile } from "@calibre-web-serverless/domain/models/bookFile";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { BookDocument as BaseBookDocument } from "../../documents/book";
import { bookFilePath, bookPath, toBook } from "./bookRepository";

// Admin-side access to a book's stored files: the entries in the book
// document's `files` map and the corresponding Storage objects.

type BookDocument = BaseBookDocument<Timestamp>;

// Download URLs are short-lived; bytes are otherwise served straight from the
// signed URL without passing through the function.
const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;

/** True when any entry other than `except` is still processing. */
const anyOtherProcessing = (
	files: Record<string, { status: string }> | undefined,
	except: string,
): boolean =>
	Object.entries(files ?? {}).some(
		([key, entry]) => key !== except && entry.status === "processing",
	);

/**
 * Persist a file entry's mutable fields (status, errorCode), keeping
 * hasProcessingFile consistent. A concurrently removed entry is left alone.
 */
const updateBookFile = async (
	userId: string,
	bookId: string,
	file: BookFile,
): Promise<void> => {
	const bookRef = getFirestore().doc(bookPath(userId, bookId));
	await getFirestore().runTransaction(async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData?.files?.[file.format]) return;
		transaction.update(bookRef, {
			[`files.${file.format}.status`]: file.status,
			[`files.${file.format}.errorCode`]: file.errorCode,
			hasProcessingFile:
				file.status === "processing" ||
				anyOtherProcessing(bookData.files, file.format),
			updatedAt: FieldValue.serverTimestamp(),
		});
	});
};

/** Remove a file entry and its Storage object (missing object is ignored). */
const deleteBookFile = async (
	userId: string,
	bookId: string,
	format: string,
): Promise<void> => {
	const bookRef = getFirestore().doc(bookPath(userId, bookId));
	await getFirestore().runTransaction(async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData?.files?.[format]) return;
		transaction.update(bookRef, {
			[`files.${format}`]: FieldValue.delete(),
			hasProcessingFile: anyOtherProcessing(bookData.files, format),
			updatedAt: FieldValue.serverTimestamp(),
		});
	});
	await getStorage()
		.bucket()
		.file(bookFilePath(userId, bookId, format))
		.delete({ ignoreNotFound: true });
};

/**
 * File entries stuck in "processing" on otherwise-ready books — added-format
 * uploads whose trigger never completed. Queries the denormalized
 * hasProcessingFile flag; processing stubs also carry it and are left to
 * findStaleProcessingBooks.
 */
const findStaleProcessingFiles = async (
	olderThan: Date,
): Promise<{ userId: string; bookId: string; file: BookFile }[]> => {
	const snapshot = await getFirestore()
		.collectionGroup("books")
		.where("hasProcessingFile", "==", true)
		.where("updatedAt", "<", Timestamp.fromDate(olderThan))
		.get();
	return snapshot.docs
		.map(toBook)
		.filter((book) => book.status === "ready")
		.flatMap((book) =>
			book.files
				.filter((file) => file.status === "processing")
				.map((file) => ({ userId: book.userId, bookId: book.id, file })),
		);
};

/** A short-lived signed URL to download the file. */
const getBookFileDownloadUrl = async (
	userId: string,
	bookId: string,
	format: string,
): Promise<string> => {
	const [url] = await getStorage()
		.bucket()
		.file(bookFilePath(userId, bookId, format))
		.getSignedUrl({
			action: "read",
			expires: Date.now() + DOWNLOAD_URL_TTL_MS,
		});
	return url;
};

/**
 * The stored file's metadata, or null when no object exists. `originalName`
 * mirrors the custom metadata the client sets, so a reprocess keeps the
 * filename title fallback the original extraction would have had.
 */
const getBookFile = async (
	userId: string,
	bookId: string,
	format: string,
): Promise<{ originalName?: string } | null> => {
	const file = getStorage()
		.bucket()
		.file(bookFilePath(userId, bookId, format));
	const [exists] = await file.exists();
	if (!exists) return null;
	const [metadata] = await file.getMetadata();
	const originalName = metadata.metadata?.originalName;
	return {
		originalName: typeof originalName === "string" ? originalName : undefined,
	};
};

/** The raw file bytes (used by metadata extraction). */
const downloadBookFile = async (
	userId: string,
	bookId: string,
	format: string,
): Promise<Buffer> => {
	const [buffer] = await getStorage()
		.bucket()
		.file(bookFilePath(userId, bookId, format))
		.download();
	return buffer;
};

export const bookFileRepository = {
	updateBookFile,
	deleteBookFile,
	findStaleProcessingFiles,
	getBookFileDownloadUrl,
	getBookFile,
	downloadBookFile,
};
