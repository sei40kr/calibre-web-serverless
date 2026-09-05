import { BookFileError } from "@calibre-web-serverless/domain/errors/bookFileError";
import { StorageError } from "@calibre-web-serverless/domain/errors/storageError";
import type { BookRepository } from "@calibre-web-serverless/domain/repositories/bookRepository";
import {
	type BookUpload,
	type BookUploadFailure,
	isBookUploadFinished,
} from "./bookUpload";

export interface BookUploadQueueDeps {
	createBook: BookRepository["createBook"];
	subscribeToBook: BookRepository["subscribeToBook"];
	/** Storage transfers running at once. Processing waits do not hold a slot. */
	maxConcurrentUploads?: number;
	/** How long to wait for metadata extraction before giving up on an item. */
	processingTimeoutMs?: number;
	generateId?: () => string;
}

/**
 * An external store (in the `useSyncExternalStore` sense) that drives book
 * uploads in the background: files are queued, transferred a few at a time,
 * then watched until metadata extraction settles. Snapshots are immutable so
 * a changed reference always means changed state.
 */
export interface BookUploadQueue {
	getSnapshot(): readonly BookUpload[];
	subscribe(listener: () => void): () => void;
	/** Add files to the queue; transfers start as slots free up. */
	enqueue(userId: string, files: readonly File[]): void;
	/** Drop one finished upload from the list. Active uploads stay. */
	dismiss(id: string): void;
	/** Drop every finished upload from the list. */
	clearFinished(): void;
}

const DEFAULT_MAX_CONCURRENT_UPLOADS = 2;
const DEFAULT_PROCESSING_TIMEOUT_MS = 120_000;

const toFailure = (error: unknown): BookUploadFailure => {
	if (error instanceof BookFileError) {
		return { kind: "file", code: error.code };
	}
	if (error instanceof StorageError) {
		return { kind: "storage", code: error.code };
	}
	return {
		kind: "unknown",
		message: error instanceof Error ? error.message : String(error),
	};
};

export function createBookUploadQueue({
	createBook,
	subscribeToBook,
	maxConcurrentUploads = DEFAULT_MAX_CONCURRENT_UPLOADS,
	processingTimeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS,
	generateId = () => crypto.randomUUID(),
}: BookUploadQueueDeps): BookUploadQueue {
	let uploads: readonly BookUpload[] = [];
	// File handles live outside the snapshot so components never see them.
	const pending = new Map<string, { userId: string; file: File }>();
	const listeners = new Set<() => void>();
	let inFlight = 0;

	const emit = () => {
		for (const listener of listeners) listener();
	};

	const patch = (id: string, changes: Partial<BookUpload>) => {
		if (!uploads.some((upload) => upload.id === id)) return;
		uploads = uploads.map((upload) =>
			upload.id === id ? { ...upload, ...changes } : upload,
		);
		emit();
	};

	const watchProcessing = (id: string, userId: string, bookId: string) => {
		let settled = false;
		let unsubscribe: (() => void) | null = null;

		const finish = (changes: Partial<BookUpload>) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			unsubscribe?.();
			patch(id, changes);
		};

		const timer = setTimeout(
			() =>
				finish({ status: "error", failure: { kind: "processing-timeout" } }),
			processingTimeoutMs,
		);

		unsubscribe = subscribeToBook(userId, bookId, {
			onData: (book) => {
				if (book.status === "ready") {
					finish({ status: "ready", title: book.title });
				} else if (book.status === "error") {
					finish({
						status: "error",
						failure: { kind: "processing", code: book.errorCode },
					});
				}
			},
			onError: (error) =>
				finish({ status: "error", failure: toFailure(error) }),
		});
		// The subscription may have delivered synchronously, before the
		// unsubscribe handle existed to be called from finish().
		if (settled) unsubscribe();
	};

	const run = async (id: string) => {
		const entry = pending.get(id);
		pending.delete(id);
		if (!entry) return;
		const { userId, file } = entry;

		patch(id, { status: "uploading" });
		try {
			const { bookId } = await createBook({
				userId,
				file,
				onProgress: (bytesTransferred) => patch(id, { bytesTransferred }),
			});
			patch(id, {
				status: "processing",
				bookId,
				bytesTransferred: file.size,
			});
			watchProcessing(id, userId, bookId);
		} catch (error) {
			patch(id, { status: "error", failure: toFailure(error) });
		}
	};

	const pump = () => {
		while (inFlight < maxConcurrentUploads) {
			const next = uploads.find((upload) => upload.status === "queued");
			if (!next) return;
			inFlight++;
			void run(next.id).finally(() => {
				inFlight--;
				pump();
			});
		}
	};

	return {
		getSnapshot: () => uploads,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		enqueue: (userId, files) => {
			if (files.length === 0) return;
			const added = files.map((file): BookUpload => {
				const id = generateId();
				pending.set(id, { userId, file });
				return {
					id,
					fileName: file.name,
					fileSize: file.size,
					bytesTransferred: 0,
					status: "queued",
					bookId: null,
					title: null,
					failure: null,
				};
			});
			uploads = [...uploads, ...added];
			emit();
			pump();
		},
		dismiss: (id) => {
			const target = uploads.find((upload) => upload.id === id);
			if (!target || !isBookUploadFinished(target)) return;
			uploads = uploads.filter((upload) => upload.id !== id);
			emit();
		},
		clearFinished: () => {
			if (!uploads.some(isBookUploadFinished)) return;
			uploads = uploads.filter((upload) => !isBookUploadFinished(upload));
			emit();
		},
	};
}
