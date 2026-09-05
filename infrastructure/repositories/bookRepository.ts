import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type BookFile,
	BookFileFormat,
} from "@calibre-web-serverless/domain/models/bookFile";
import type {
	BookFilter,
	BookSort,
} from "@calibre-web-serverless/domain/models/bookQuery";
import {
	type Identifier,
	IdentifierType,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import type { BookRepository } from "@calibre-web-serverless/domain/repositories/bookRepository";
import { FirebaseError } from "firebase/app";
import {
	collection,
	type DocumentData,
	deleteDoc,
	doc,
	type FieldValue,
	type FirestoreDataConverter,
	getDoc,
	getDocs,
	increment,
	onSnapshot,
	type QueryDocumentSnapshot,
	query,
	runTransaction,
	type SnapshotOptions,
	serverTimestamp,
	setDoc,
	type Timestamp,
	type Transaction,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import type {
	BookDocument as BaseBookDocument,
	BookFileDocument as BaseBookFileDocument,
	IdentifierDocument,
} from "../documents/book";
import { db, storage } from "../lib/firebase";
import {
	bookFileStorageRef,
	formatFromFileName,
	processingFileEntry,
	toUploadError,
	uploadWithStallGuard,
} from "./bookFileRepository";
import { buildBookQueryConstraints } from "./bookQuery";

const toIdentifier = (doc: IdentifierDocument): Identifier => {
	const type = IdentifierType.from(doc.type);
	if (!type) {
		throw new Error(`Unknown identifier type: ${doc.type}`);
	}
	return { type, value: doc.value };
};

type BookDocument = BaseBookDocument<Timestamp>;
type BookFileDocument = BaseBookFileDocument<Timestamp>;

// Entries with an unsupported format key are dropped rather than crashing
// the whole book.
const toBookFiles = (
	files: Record<string, BookFileDocument> | undefined,
): BookFile[] =>
	Object.entries(files ?? {})
		.flatMap(([key, file]): BookFile[] => {
			const format = BookFileFormat.from(key);
			if (!format) return [];
			return [
				{
					format,
					fileSize: file.fileSize ?? 0,
					status: file.status ?? "ready",
					errorCode: file.errorCode ?? null,
					addedAt: file.addedAt?.toDate() ?? null,
				},
			];
		})
		.sort((a, b) => a.format.localeCompare(b.format));

// toFirestore omits `files`/`hasProcessingFile` so a metadata save can never
// clobber an in-flight format upload; file state is mutated only through the
// per-file operations below. `bookshelfIds` is omitted for the same reason: bookshelf
// membership is owned by bookshelfRepository, which keeps it in step with each
// bookshelf's bookCount.
const bookConverter: FirestoreDataConverter<Book> = {
	toFirestore(book: Book): DocumentData {
		return {
			title: book.title,
			sortTitle: book.sortTitle,
			authorIds: book.authorIds,
			seriesId: book.seriesId,
			seriesIndex: book.seriesIndex,
			tagIds: book.tagIds,
			publisherId: book.publisherId,
			pubDate: book.pubDate,
			identifiers: book.identifiers.map((id) => ({
				type: id.type.value,
				value: id.value,
			})),
			languages: book.languages.map((l) => l.code),
			description: book.description,
			rating: book.rating,
			hasCover: book.hasCover,
			hasCustomCover: book.hasCustomCover,
			status: book.status,
			errorCode: book.errorCode,
			updatedAt: serverTimestamp(),
		} as Omit<
			BookDocument,
			"createdAt" | "updatedAt" | "files" | "hasProcessingFile" | "bookshelfIds"
		> & {
			updatedAt: FieldValue;
		};
	},
	fromFirestore(
		snapshot: QueryDocumentSnapshot,
		options?: SnapshotOptions,
	): Book {
		const d = snapshot.data(options) as BookDocument;
		return {
			id: snapshot.id,
			// biome-ignore lint/style/noNonNullAssertion: a book doc always has a parent user
			userId: snapshot.ref.parent.parent!.id,
			title: d.title,
			sortTitle: d.sortTitle,
			authorIds: d.authorIds,
			seriesId: d.seriesId,
			seriesIndex: d.seriesIndex,
			tagIds: d.tagIds,
			bookshelfIds: d.bookshelfIds ?? [],
			publisherId: d.publisherId,
			pubDate: d.pubDate?.toDate() ?? null,
			identifiers: (d.identifiers ?? []).map(toIdentifier),
			languages: (d.languages ?? []).flatMap((code) => {
				const lang = Language.from(code);
				return lang ? [lang] : [];
			}),
			description: d.description,
			rating: d.rating,
			files: toBookFiles(d.files),
			hasCover: d.hasCover ?? false,
			hasCustomCover: d.hasCustomCover ?? false,
			status: d.status ?? "ready",
			errorCode: d.errorCode ?? null,
			createdAt: d.createdAt?.toDate() ?? null,
			updatedAt: d.updatedAt?.toDate() ?? null,
		};
	},
};

const hasBooks = async (userId: string): Promise<boolean> => {
	const booksRef = collection(db, "users", userId, "books");
	const booksSnapshot = await getDocs(booksRef);
	return !booksSnapshot.empty;
};

const getBook = async (
	userId: string,
	bookId: string,
): Promise<Book | null> => {
	const bookRef = doc(db, "users", userId, "books", bookId).withConverter(
		bookConverter,
	);
	const bookDoc = await getDoc(bookRef);
	return bookDoc.data() ?? null;
};

const subscribeToBooks = (
	userId: string,
	{
		bookshelfId,
		filter,
		sort,
		onData,
		onError,
	}: {
		bookshelfId?: string;
		filter?: BookFilter;
		sort?: BookSort;
		onData: (books: Book[]) => void;
		onError: (error: Error) => void;
	},
): (() => void) => {
	const booksRef = collection(db, "users", userId, "books").withConverter(
		bookConverter,
	);
	const q = query(
		booksRef,
		...buildBookQueryConstraints(filter, sort, bookshelfId),
	);

	return onSnapshot(
		q,
		(snapshot) => {
			onData(snapshot.docs.map((d) => d.data()));
		},
		onError,
	);
};

const subscribeToBook = (
	userId: string,
	bookId: string,
	{
		onData,
		onError,
	}: {
		onData: (book: Book) => void;
		onError: (error: Error) => void;
	},
): (() => void) => {
	const bookRef = doc(db, "users", userId, "books", bookId).withConverter(
		bookConverter,
	);

	return onSnapshot(
		bookRef,
		(snapshot) => {
			const data = snapshot.data();
			if (data) {
				onData(data);
			}
		},
		onError,
	);
};

interface CreateBookParams {
	userId: string;
	file: File;
	onProgress?: (bytesTransferred: number, totalBytes: number) => void;
}

const createBook = async ({ userId, file, onProgress }: CreateBookParams) => {
	const format = formatFromFileName(file.name);
	const bookId = crypto.randomUUID();

	// Create the stub Firestore doc with processing status *before* uploading
	// the file. The Storage upload is what triggers the extractBookMetadata
	// Cloud Function, and a warm function instance can read the doc before this
	// write lands — leaving status stuck on "processing" forever (the function
	// returns early when the book is not found). Writing the doc first closes
	// that race.
	//
	// The flip side is that a doc now exists before the upload lands, so an
	// interrupted upload would orphan it in "processing". We roll it back below
	// on any client-observable failure; the scheduled reconcile
	// (reconcileStaleProcessingBooks) is the guaranteed net for the cases the
	// client cannot handle — e.g. the connection dies, so the rollback delete
	// cannot reach Firestore either.
	const bookRef = doc(db, "users", userId, "books", bookId);
	const bookData: Omit<BookDocument, "createdAt" | "updatedAt" | "files"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
		files: Record<string, ReturnType<typeof processingFileEntry>>;
	} = {
		title: "",
		sortTitle: null,
		authorIds: [],
		seriesId: null,
		seriesIndex: 1.0,
		tagIds: [],
		bookshelfIds: [],
		publisherId: null,
		pubDate: null,
		identifiers: [],
		languages: [],
		description: null,
		rating: null,
		files: { [format]: processingFileEntry(file.size) },
		hasProcessingFile: true,
		hasCover: false,
		hasCustomCover: false,
		status: "processing",
		errorCode: null,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	await setDoc(bookRef, bookData);

	// Then upload the file to Storage, which triggers metadata extraction.
	let stalled = false;
	try {
		await uploadWithStallGuard(
			bookFileStorageRef(userId, bookId, format),
			file,
			() => {
				stalled = true;
			},
			onProgress,
		);
	} catch (error) {
		// Best-effort rollback so a failed upload does not leave an orphaned book
		// stuck in "processing". If the network is what failed, this delete may
		// fail too — that is expected; the scheduled reconcile guarantees cleanup.
		await deleteDoc(bookRef).catch(() => {});
		throw toUploadError(error, stalled);
	}

	return { bookId, format };
};

const syncBookCounts = async (
	transaction: Transaction,
	userId: string,
	changes: {
		authors: { oldIds: string[]; newIds: string[] };
		series: { oldIds: string[]; newIds: string[] };
		tags: { oldIds: string[]; newIds: string[] };
		publishers: { oldIds: string[]; newIds: string[] };
	},
): Promise<void> => {
	// Firestore transactions require every read to happen before any write, so
	// the read and write phases below must span all collections at once rather
	// than be interleaved per collection.
	const plans = Object.entries(changes).map(
		([collectionName, { oldIds, newIds }]) => {
			const oldIdSet = new Set(oldIds);
			const newIdSet = new Set(newIds);
			return {
				collectionName,
				addedIds: newIds.filter((id) => !oldIdSet.has(id)),
				removedIds: oldIds.filter((id) => !newIdSet.has(id)),
			};
		},
	);

	// Read phase: fetch every removed doc across all collections to check counts.
	const removedDocsByPlan = await Promise.all(
		plans.map((plan) =>
			Promise.all(
				plan.removedIds.map((id) =>
					transaction.get(doc(db, "users", userId, plan.collectionName, id)),
				),
			),
		),
	);

	// Write phase: increment for added, decrement/delete for removed.
	plans.forEach((plan, planIndex) => {
		for (const id of plan.addedIds) {
			const ref = doc(db, "users", userId, plan.collectionName, id);
			transaction.update(ref, { bookCount: increment(1) });
		}

		plan.removedIds.forEach((id, i) => {
			const ref = doc(db, "users", userId, plan.collectionName, id);
			const currentCount =
				removedDocsByPlan[planIndex][i].data()?.bookCount ?? 0;
			if (currentCount <= 1) {
				transaction.delete(ref);
			} else {
				transaction.update(ref, { bookCount: increment(-1) });
			}
		});
	});
};

const updateBook = async (userId: string, book: Book) => {
	const bookRef = doc(db, "users", userId, "books", book.id).withConverter(
		bookConverter,
	);

	await runTransaction(db, async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data();

		const oldAuthorIds = bookData?.authorIds ?? [];
		const oldSeriesIds = bookData?.seriesId ? [bookData.seriesId] : [];
		const oldTagIds = bookData?.tagIds ?? [];
		const oldPublisherIds = bookData?.publisherId ? [bookData.publisherId] : [];

		const newSeriesIds = book.seriesId ? [book.seriesId] : [];
		const newPublisherIds = book.publisherId ? [book.publisherId] : [];

		// syncBookCounts does reads then writes internally,
		// so call before other writes
		await syncBookCounts(transaction, userId, {
			authors: { oldIds: oldAuthorIds, newIds: book.authorIds },
			series: { oldIds: oldSeriesIds, newIds: newSeriesIds },
			tags: { oldIds: oldTagIds, newIds: book.tagIds },
			publishers: { oldIds: oldPublisherIds, newIds: newPublisherIds },
		});

		transaction.set(bookRef, book, { merge: true });
	});
};

const deleteBook = async (userId: string, bookId: string): Promise<void> => {
	const bookRef = doc(db, "users", userId, "books", bookId);

	let formats: string[] = [];
	let hasCover = false;
	let hasCustomCover = false;

	await runTransaction(db, async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData) {
			return;
		}

		formats = Object.keys(bookData.files ?? {});
		hasCover = bookData.hasCover ?? false;
		hasCustomCover = bookData.hasCustomCover ?? false;

		const oldAuthorIds = bookData.authorIds ?? [];
		const oldSeriesIds = bookData.seriesId ? [bookData.seriesId] : [];
		const oldTagIds = bookData.tagIds ?? [];
		const oldPublisherIds = bookData.publisherId ? [bookData.publisherId] : [];

		// Bookshelves outlive their books, so unlike the relations above they are
		// only decremented, never deleted. Their reads must precede every write
		// in the transaction, including syncBookCounts' own.
		const bookshelfSnapshots = await Promise.all(
			(bookData.bookshelfIds ?? []).map((bookshelfId) =>
				transaction.get(doc(db, "users", userId, "bookshelves", bookshelfId)),
			),
		);

		// syncBookCounts does reads then writes internally, so call before the
		// delete. Empty newIds decrements (and removes orphaned) related docs.
		await syncBookCounts(transaction, userId, {
			authors: { oldIds: oldAuthorIds, newIds: [] },
			series: { oldIds: oldSeriesIds, newIds: [] },
			tags: { oldIds: oldTagIds, newIds: [] },
			publishers: { oldIds: oldPublisherIds, newIds: [] },
		});

		for (const bookshelfSnapshot of bookshelfSnapshots) {
			if (!bookshelfSnapshot.exists()) continue;
			transaction.update(bookshelfSnapshot.ref, {
				bookCount: Math.max(0, (bookshelfSnapshot.data().bookCount ?? 0) - 1),
			});
		}

		transaction.delete(bookRef);
	});

	// Remove Storage objects after the Firestore doc is gone. A missing object
	// is ignored so deletion stays idempotent even on partial earlier failures.
	const ignoreMissing = (error: unknown) => {
		if (
			error instanceof FirebaseError &&
			error.code === "storage/object-not-found"
		) {
			return;
		}
		throw error;
	};

	const deletions: Promise<void>[] = formats.map((format) =>
		deleteObject(
			ref(storage, `users/${userId}/books/${bookId}/book.${format}`),
		).catch(ignoreMissing),
	);
	if (hasCover) {
		deletions.push(
			deleteObject(
				ref(storage, `users/${userId}/books/${bookId}/cover.png`),
			).catch(ignoreMissing),
		);
	}
	if (hasCustomCover) {
		deletions.push(
			deleteObject(
				ref(storage, `users/${userId}/books/${bookId}/custom_cover.png`),
			).catch(ignoreMissing),
		);
	}
	await Promise.all(deletions);
};

export const bookRepository: BookRepository = {
	hasBooks,
	getBook,
	subscribeToBooks,
	subscribeToBook,
	createBook,
	updateBook,
	deleteBook,
};
