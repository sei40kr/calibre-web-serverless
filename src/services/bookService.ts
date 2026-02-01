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
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Book } from "@/models/book";
import { type Identifier, IdentifierType } from "@/models/identifier";
import { Language } from "@/models/language";

interface IdentifierDocument {
	type: string;
	value: string;
}

const toIdentifier = (doc: IdentifierDocument): Identifier => {
	const type = IdentifierType.from(doc.type);
	if (!type) {
		throw new Error(`Unknown identifier type: ${doc.type}`);
	}
	return { type, value: doc.value };
};

interface BookDocument {
	id: string;
	title: string;
	sortTitle: string | null;
	authorIds: string[];
	seriesId: string | null;
	seriesIndex: number;
	tagIds: string[];
	publisherId: string | null;
	pubDate: Timestamp | null;
	identifiers: IdentifierDocument[];
	languages: string[];
	description: string | null;
	rating: number | null;
	format: string;
	fileSize: number;
	coverFormat: string | null;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

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
			updatedAt: serverTimestamp(),
		} as Omit<BookDocument, "id" | "createdAt" | "updatedAt"> & {
			updatedAt: FieldValue;
		};
	},
	fromFirestore(
		snapshot: QueryDocumentSnapshot,
		options?: SnapshotOptions,
	): Book {
		const d = snapshot.data(options) as Omit<BookDocument, "id">;
		return {
			id: snapshot.id,
			title: d.title,
			sortTitle: d.sortTitle,
			authorIds: d.authorIds,
			seriesId: d.seriesId,
			seriesIndex: d.seriesIndex,
			tagIds: d.tagIds,
			publisherId: d.publisherId,
			pubDate: d.pubDate?.toDate() ?? null,
			identifiers: d.identifiers.map(toIdentifier),
			languages: d.languages.flatMap((code) => {
				const lang = Language.from(code);
				return lang ? [lang] : [];
			}),
			description: d.description,
			rating: d.rating,
			format: d.format,
			fileSize: d.fileSize,
			coverFormat: d.coverFormat,
			createdAt: d.createdAt.toDate(),
			updatedAt: d.updatedAt.toDate(),
		};
	},
};

export const hasBooks = async (userId: string): Promise<boolean> => {
	const booksRef = collection(db, "users", userId, "books");
	const booksSnapshot = await getDocs(booksRef);
	return !booksSnapshot.empty;
};

export const getBook = async (
	userId: string,
	bookId: string,
): Promise<Book | null> => {
	const bookRef = doc(db, "users", userId, "books", bookId).withConverter(
		bookConverter,
	);
	const bookDoc = await getDoc(bookRef);
	return bookDoc.data() ?? null;
};

export const subscribeToBooks = (
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

export const getBookDownloadUrl = async (
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
	title: string;
	file: File;
}

export const uploadBook = async ({ userId, title, file }: UploadBookParams) => {
	const format = file.name.split(".").pop()?.toLowerCase() || "unknown";
	const bookId = crypto.randomUUID();
	const bookRef = doc(db, "users", userId, "books", bookId);

	const bookData: Omit<BookDocument, "id" | "createdAt" | "updatedAt"> & {
		createdAt: FieldValue;
		updatedAt: FieldValue;
	} = {
		title,
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
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	await setDoc(bookRef, bookData);

	try {
		const storageRef = ref(
			storage,
			`users/${userId}/books/${bookId}/book.${format}`,
		);
		await uploadBytes(storageRef, file);
	} catch (error) {
		await deleteDoc(doc(db, "users", userId, "books", bookId));
		throw error;
	}

	return { bookId, format };
};

const syncBookCountInCollection = async (
	transaction: Transaction,
	userId: string,
	collectionName: string,
	oldIds: string[],
	newIds: string[],
): Promise<void> => {
	const oldIdSet = new Set(oldIds);
	const newIdSet = new Set(newIds);
	const addedIds = newIds.filter((id) => !oldIdSet.has(id));
	const removedIds = oldIds.filter((id) => !newIdSet.has(id));

	// Read phase: fetch removed docs to check counts
	const removedDocs = await Promise.all(
		removedIds.map((id) =>
			transaction.get(doc(db, "users", userId, collectionName, id)),
		),
	);

	// Write phase: increment for added, decrement/delete for removed
	for (const id of addedIds) {
		const ref = doc(db, "users", userId, collectionName, id);
		transaction.update(ref, { bookCount: increment(1) });
	}

	for (let i = 0; i < removedIds.length; i++) {
		const ref = doc(db, "users", userId, collectionName, removedIds[i]);
		const currentCount = removedDocs[i].data()?.bookCount ?? 0;
		if (currentCount <= 1) {
			transaction.delete(ref);
		} else {
			transaction.update(ref, { bookCount: increment(-1) });
		}
	}
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
	for (const [collectionName, { oldIds, newIds }] of Object.entries(changes)) {
		await syncBookCountInCollection(
			transaction,
			userId,
			collectionName,
			oldIds,
			newIds,
		);
	}
};

export const updateBook = async (userId: string, book: Book) => {
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
