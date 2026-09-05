import { BookFileError } from "@calibre-web-serverless/domain/errors/bookFileError";
import type { StorageErrorCode } from "@calibre-web-serverless/domain/errors/storageError";
import { StorageError } from "@calibre-web-serverless/domain/errors/storageError";
import { BookFileFormat } from "@calibre-web-serverless/domain/models/bookFile";
import type { BookFileRepository } from "@calibre-web-serverless/domain/repositories/bookFileRepository";
import { FirebaseError } from "firebase/app";
import {
	deleteField,
	doc,
	type FieldValue,
	runTransaction,
	serverTimestamp,
	type Timestamp,
} from "firebase/firestore";
import {
	deleteObject,
	getDownloadURL,
	ref,
	type StorageReference,
	uploadBytesResumable,
} from "firebase/storage";
import type {
	BookDocument as BaseBookDocument,
	BookFileDocument as BaseBookFileDocument,
} from "../documents/book";
import { db, storage } from "../lib/firebase";

type BookDocument = BaseBookDocument<Timestamp>;
type BookFileDocument = BaseBookFileDocument<Timestamp>;

export const bookFileStorageRef = (
	userId: string,
	bookId: string,
	format: BookFileFormat,
): StorageReference =>
	ref(storage, `users/${userId}/books/${bookId}/book.${format}`);

/** The format implied by an upload's filename, or a typed rejection. */
export const formatFromFileName = (fileName: string): BookFileFormat => {
	const format = BookFileFormat.from(fileName.split(".").pop() ?? "");
	if (!format) {
		throw new BookFileError(
			"unsupported-format",
			`Unsupported book format: ${fileName}`,
		);
	}
	return format;
};

/** Map a failed Storage upload to the domain error uploads surface. */
export const toUploadError = (error: unknown, stalled: boolean): Error => {
	if (stalled) {
		return new StorageError(
			"stalled",
			"Upload stalled and was aborted after no progress",
		);
	}
	if (error instanceof FirebaseError) {
		const codeMap: Record<string, StorageErrorCode> = {
			"storage/unauthorized": "unauthorized",
			"storage/canceled": "canceled",
			"storage/quota-exceeded": "quota-exceeded",
		};
		return new StorageError(codeMap[error.code] ?? "unknown", error.message);
	}
	return error instanceof Error ? error : new Error(String(error));
};

export const processingFileEntry = (
	fileSize: number,
): Omit<BookFileDocument, "addedAt"> & { addedAt: FieldValue } => ({
	fileSize,
	status: "processing",
	errorCode: null,
	addedAt: serverTimestamp(),
});

// If the upload transfers no bytes for this long we treat the connection as
// dead and abort, instead of letting the promise hang indefinitely — which on
// mobile (a backgrounded tab or lost signal freezing the page's JS) it
// otherwise can, leaving the file entry stranded in "processing".
const UPLOAD_STALL_TIMEOUT_MS = 60_000;
const UPLOAD_STALL_CHECK_INTERVAL_MS = 5_000;

// Uploads the file through a resumable task guarded by a stall watchdog.
// Resolves on success. On a stall it cancels the task (which rejects the
// awaited task) and signals via onStall so the caller can tell a dead
// connection apart from other Storage failures. onProgress relays the bytes
// transferred so far.
export const uploadWithStallGuard = async (
	storageRef: StorageReference,
	file: File,
	onStall: () => void,
	onProgress?: (bytesTransferred: number, totalBytes: number) => void,
): Promise<void> => {
	// The stored object is always named book.<format>, so preserve the original
	// filename in custom metadata for the extraction function to fall back on
	// when the file itself carries no title.
	const task = uploadBytesResumable(storageRef, file, {
		customMetadata: { originalName: file.name },
	});

	let lastTransferred = 0;
	let lastAdvance = Date.now();
	const watchdog = setInterval(() => {
		if (Date.now() - lastAdvance >= UPLOAD_STALL_TIMEOUT_MS) {
			onStall();
			task.cancel();
		}
	}, UPLOAD_STALL_CHECK_INTERVAL_MS);

	task.on("state_changed", (snapshot) => {
		if (snapshot.bytesTransferred > lastTransferred) {
			lastTransferred = snapshot.bytesTransferred;
			lastAdvance = Date.now();
			onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes);
		}
	});

	try {
		await task;
	} finally {
		clearInterval(watchdog);
	}
};

interface AddBookFileParams {
	userId: string;
	bookId: string;
	file: File;
}

// Mirrors createBook's write order: register the entry before the Storage
// upload so the extraction trigger always finds it, roll back on failure,
// and let the scheduled reconcile net the rest.
const addBookFile = async ({ userId, bookId, file }: AddBookFileParams) => {
	const format = formatFromFileName(file.name);
	const bookRef = doc(db, "users", userId, "books", bookId);

	await runTransaction(db, async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData) {
			throw new BookFileError("book-not-found", `Book not found: ${bookId}`);
		}
		if (bookData.status !== "ready") {
			throw new BookFileError(
				"book-not-ready",
				"Formats can only be added once the book is ready",
			);
		}
		if (bookData.files?.[format]) {
			throw new BookFileError(
				"duplicate-format",
				`Book already has a ${format} file`,
			);
		}
		transaction.update(bookRef, {
			[`files.${format}`]: processingFileEntry(file.size),
			hasProcessingFile: true,
			updatedAt: serverTimestamp(),
		});
	});

	let stalled = false;
	try {
		await uploadWithStallGuard(
			bookFileStorageRef(userId, bookId, format),
			file,
			() => {
				stalled = true;
			},
		);
	} catch (error) {
		await removeFileEntry(userId, bookId, format).catch(() => {});
		throw toUploadError(error, stalled);
	}

	return { format };
};

const removeFileEntry = async (
	userId: string,
	bookId: string,
	format: BookFileFormat,
): Promise<void> => {
	const bookRef = doc(db, "users", userId, "books", bookId);
	await runTransaction(db, async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData?.files?.[format]) {
			return;
		}
		const stillProcessing = Object.entries(bookData.files).some(
			([key, entry]) => key !== format && entry.status === "processing",
		);
		transaction.update(bookRef, {
			[`files.${format}`]: deleteField(),
			hasProcessingFile: stillProcessing,
			updatedAt: serverTimestamp(),
		});
	});
};

const deleteBookFile = async (
	userId: string,
	bookId: string,
	format: BookFileFormat,
): Promise<void> => {
	const bookRef = doc(db, "users", userId, "books", bookId);

	await runTransaction(db, async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData) {
			throw new BookFileError("book-not-found", `Book not found: ${bookId}`);
		}
		const files = bookData.files ?? {};
		if (!files[format]) {
			// Already gone from the doc; still sweep Storage below for idempotency.
			return;
		}
		if (Object.keys(files).length <= 1) {
			throw new BookFileError(
				"last-file",
				"A book's last remaining file cannot be removed; delete the book instead",
			);
		}
		const stillProcessing = Object.entries(files).some(
			([key, entry]) => key !== format && entry.status === "processing",
		);
		transaction.update(bookRef, {
			[`files.${format}`]: deleteField(),
			hasProcessingFile: stillProcessing,
			updatedAt: serverTimestamp(),
		});
	});

	await deleteObject(bookFileStorageRef(userId, bookId, format)).catch(
		(error: unknown) => {
			if (
				error instanceof FirebaseError &&
				error.code === "storage/object-not-found"
			) {
				return;
			}
			throw error;
		},
	);
};

const getBookFileDownloadUrl = async (
	userId: string,
	bookId: string,
	format: BookFileFormat,
): Promise<string> =>
	getDownloadURL(bookFileStorageRef(userId, bookId, format));

export const bookFileRepository: BookFileRepository = {
	addBookFile,
	deleteBookFile,
	getBookFileDownloadUrl,
};
