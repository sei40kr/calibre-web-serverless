import type { StorageErrorCode } from "@calibre-web-serverless/domain/errors/storageError";
import { StorageError } from "@calibre-web-serverless/domain/errors/storageError";
import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type Identifier,
	IdentifierType,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import type { BookRepository } from "@calibre-web-serverless/domain/repositories/bookRepository";
import type {
	BookDocument as BaseBookDocument,
	IdentifierDocument,
} from "@calibre-web-serverless/firestore-documents/book";
import { FirebaseError } from "firebase/app";
import {
	collection,
	type DocumentData,
	doc,
	type FieldValue,
	type FirestoreDataConverter,
	getDoc,
	getDocs,
	increment,
	onSnapshot,
	orderBy,
	type QueryDocumentSnapshot,
	query,
	runTransaction,
	type SnapshotOptions,
	serverTimestamp,
	setDoc,
	type Timestamp,
	type Transaction,
} from "firebase/firestore";
import {
	deleteObject,
	getDownloadURL,
	ref,
	uploadBytes,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";

const toIdentifier = (doc: IdentifierDocument): Identifier => {
	const type = IdentifierType.from(doc.type);
	if (!type) {
		throw new Error(`Unknown identifier type: ${doc.type}`);
	}
	return { type, value: doc.value };
};

type BookDocument = BaseBookDocument<Timestamp>;

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
			format: book.format,
			fileSize: book.fileSize,
			coverFormat: book.coverFormat,
			status: book.status,
			errorMessage: book.errorMessage,
			updatedAt: serverTimestamp(),
		} as Omit<BookDocument, "createdAt" | "updatedAt"> & {
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
			userId: snapshot.ref.parent.parent!.id,
			title: d.title,
			sortTitle: d.sortTitle,
			authorIds: d.authorIds,
			seriesId: d.seriesId,
			seriesIndex: d.seriesIndex,
			tagIds: d.tagIds,
			publisherId: d.publisherId,
			pubDate: d.pubDate?.toDate() ?? null,
			identifiers: (d.identifiers ?? []).map(toIdentifier),
			languages: (d.languages ?? []).flatMap((code) => {
				const lang = Language.from(code);
				return lang ? [lang] : [];
			}),
			description: d.description,
			rating: d.rating,
			format: d.format,
			fileSize: d.fileSize,
			coverFormat: d.coverFormat ?? null,
			status: d.status ?? "ready",
			errorMessage: d.errorMessage ?? null,
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
		onData,
		onError,
	}: {
		onData: (books: Book[]) => void;
		onError: (error: Error) => void;
	},
): (() => void) => {
	const booksRef = collection(db, "users", userId, "books").withConverter(
		bookConverter,
	);
	const q = query(booksRef, orderBy("createdAt", "desc"));

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

const getBookDownloadUrl = async (
	userId: string,
	bookId: string,
	format: string,
): Promise<string> => {
	const storageRef = ref(
		storage,
		`users/${userId}/books/${bookId}/book.${format}`,
	);
	return getDownloadURL(storageRef);
};

interface UploadBookParams {
	userId: string;
	file: File;
}

const uploadBook = async ({ userId, file }: UploadBookParams) => {
	const format = file.name.split(".").pop()?.toLowerCase() || "unknown";
	const bookId = crypto.randomUUID();

	// Upload file to Storage first
	try {
		const storageRef = ref(
			storage,
			`users/${userId}/books/${bookId}/book.${format}`,
		);
		// The stored object is always named book.<format>, so preserve the
		// original filename in custom metadata for the extraction function to
		// fall back on when the file itself carries no title.
		await uploadBytes(storageRef, file, {
			customMetadata: { originalName: file.name },
		});
	} catch (error) {
		if (error instanceof FirebaseError) {
			const codeMap: Record<string, StorageErrorCode> = {
				"storage/unauthorized": "unauthorized",
				"storage/canceled": "canceled",
				"storage/quota-exceeded": "quota-exceeded",
			};
			throw new StorageError(codeMap[error.code] ?? "unknown", error.message);
		}
		throw error;
	}

	// Then create stub Firestore doc with processing status
	const bookRef = doc(db, "users", userId, "books", bookId);
	const bookData: Omit<BookDocument, "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		title: "",
		sortTitle: null,
		authorIds: [],
		seriesId: null,
		seriesIndex: 1.0,
		tagIds: [],
		publisherId: null,
		pubDate: null,
		identifiers: [],
		languages: [],
		description: null,
		rating: null,
		format,
		fileSize: file.size,
		coverFormat: null,
		status: "processing",
		errorMessage: null,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	await setDoc(bookRef, bookData);

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

	let format: string | undefined;
	let coverFormat: string | null = null;

	await runTransaction(db, async (transaction) => {
		const bookDoc = await transaction.get(bookRef);
		const bookData = bookDoc.data() as BookDocument | undefined;
		if (!bookData) {
			return;
		}

		format = bookData.format;
		coverFormat = bookData.coverFormat ?? null;

		const oldAuthorIds = bookData.authorIds ?? [];
		const oldSeriesIds = bookData.seriesId ? [bookData.seriesId] : [];
		const oldTagIds = bookData.tagIds ?? [];
		const oldPublisherIds = bookData.publisherId ? [bookData.publisherId] : [];

		// syncBookCounts does reads then writes internally, so call before the
		// delete. Empty newIds decrements (and removes orphaned) related docs.
		await syncBookCounts(transaction, userId, {
			authors: { oldIds: oldAuthorIds, newIds: [] },
			series: { oldIds: oldSeriesIds, newIds: [] },
			tags: { oldIds: oldTagIds, newIds: [] },
			publishers: { oldIds: oldPublisherIds, newIds: [] },
		});

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

	const deletions: Promise<void>[] = [];
	if (format) {
		deletions.push(
			deleteObject(
				ref(storage, `users/${userId}/books/${bookId}/book.${format}`),
			).catch(ignoreMissing),
		);
	}
	if (coverFormat) {
		deletions.push(
			deleteObject(
				ref(storage, `users/${userId}/books/${bookId}/cover.${coverFormat}`),
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
	getBookDownloadUrl,
	uploadBook,
	updateBook,
	deleteBook,
};
