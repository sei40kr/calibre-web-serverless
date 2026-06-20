import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type Identifier,
	IdentifierType,
} from "@calibre-web-serverless/domain/models/identifier";
import { Language } from "@calibre-web-serverless/domain/models/language";
import {
	type DocumentData,
	type DocumentSnapshot,
	FieldValue,
	getFirestore,
	Timestamp,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type {
	BookDocument as BaseBookDocument,
	IdentifierDocument,
} from "../../documents/book";

// Admin-side access to books — the Firestore document and the stored file.
// Model <-> document conversion stays here so the firebase-admin Timestamp type
// never leaks out. Mirrors the client bookRepository conventions (getBook,
// getBookDownloadUrl, updateBook).

type BookDocument = BaseBookDocument<Timestamp>;

// Catalog reads are limited to ready books: only they have a stored file and
// extracted metadata.
const READY_STATUS = "ready";

// Download URLs are short-lived; bytes are otherwise served straight from the
// signed URL without passing through the function.
const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;

const booksPath = (userId: string) => `users/${userId}/books`;
const bookPath = (userId: string, bookId: string) =>
	`${booksPath(userId)}/${bookId}`;
const bookFilePath = (userId: string, bookId: string, format: string) =>
	`${bookPath(userId, bookId)}/book.${format}`;

const toIdentifier = (doc: IdentifierDocument): Identifier => {
	const type = IdentifierType.from(doc.type);
	if (!type) throw new Error(`Unknown identifier type: ${doc.type}`);
	return { type, value: doc.value };
};

function toBook(snapshot: DocumentSnapshot): Book {
	const d = snapshot.data() as BookDocument;
	return {
		id: snapshot.id,
		// biome-ignore lint/style/noNonNullAssertion: a book doc always has a parent user
		userId: snapshot.ref.parent.parent!.id,
		title: d.title ?? "",
		sortTitle: d.sortTitle ?? null,
		authorIds: d.authorIds ?? [],
		seriesId: d.seriesId ?? null,
		seriesIndex: d.seriesIndex ?? 0,
		tagIds: d.tagIds ?? [],
		publisherId: d.publisherId ?? null,
		pubDate: d.pubDate?.toDate() ?? null,
		identifiers: (d.identifiers ?? []).map(toIdentifier),
		languages: (d.languages ?? []).flatMap((code) => {
			const lang = Language.from(code);
			return lang ? [lang] : [];
		}),
		description: d.description ?? null,
		rating: d.rating ?? null,
		format: d.format ?? "",
		fileSize: d.fileSize ?? 0,
		hasCover: d.hasCover ?? false,
		hasCustomCover: d.hasCustomCover ?? false,
		status: d.status ?? "ready",
		errorMessage: d.errorMessage ?? null,
		createdAt: d.createdAt?.toDate() ?? null,
		updatedAt: d.updatedAt?.toDate() ?? null,
	};
}

function toBookDocument(book: Book): DocumentData {
	const document: Omit<BookDocument, "createdAt" | "updatedAt"> & {
		updatedAt: FieldValue;
	} = {
		title: book.title,
		sortTitle: book.sortTitle,
		authorIds: book.authorIds,
		seriesId: book.seriesId,
		seriesIndex: book.seriesIndex,
		tagIds: book.tagIds,
		publisherId: book.publisherId,
		pubDate: book.pubDate ? Timestamp.fromDate(book.pubDate) : null,
		identifiers: book.identifiers.map((id) => ({
			type: id.type.value,
			value: id.value,
		})),
		languages: book.languages.map((l) => l.code),
		description: book.description,
		rating: book.rating,
		format: book.format,
		fileSize: book.fileSize,
		hasCover: book.hasCover,
		hasCustomCover: book.hasCustomCover,
		status: book.status,
		errorMessage: book.errorMessage,
		updatedAt: FieldValue.serverTimestamp(),
	};
	return document;
}

/** Total ready books for a user. */
const countBooks = async (userId: string): Promise<number> => {
	const snapshot = await getFirestore()
		.collection(booksPath(userId))
		.where("status", "==", READY_STATUS)
		.count()
		.get();
	return snapshot.data().count;
};

/** A window of ready books, newest first. Callers own pagination. */
const searchBooks = async (
	userId: string,
	{ offset, limit }: { offset: number; limit: number },
): Promise<Book[]> => {
	const snapshot = await getFirestore()
		.collection(booksPath(userId))
		.where("status", "==", READY_STATUS)
		.orderBy("createdAt", "desc")
		.offset(offset)
		.limit(limit)
		.get();
	return snapshot.docs.map(toBook);
};

/** A single book scoped to the owning user, or null if it does not exist. */
const getBook = async (
	userId: string,
	bookId: string,
): Promise<Book | null> => {
	const doc = await getFirestore().doc(bookPath(userId, bookId)).get();
	return doc.exists ? toBook(doc) : null;
};

/** Persist a book's mutable fields (status, metadata, cover flags). */
const updateBook = async (userId: string, book: Book): Promise<void> => {
	await getFirestore()
		.doc(bookPath(userId, book.id))
		.update(toBookDocument(book));
};

/** A short-lived signed URL to download the book file. */
const getBookDownloadUrl = async (
	userId: string,
	bookId: string,
	format: string,
): Promise<string> => {
	const file = getStorage()
		.bucket()
		.file(bookFilePath(userId, bookId, format));
	const [url] = await file.getSignedUrl({
		action: "read",
		expires: Date.now() + DOWNLOAD_URL_TTL_MS,
	});
	return url;
};

/** The raw book file bytes (used by metadata extraction). */
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

export const bookRepository = {
	countBooks,
	searchBooks,
	getBook,
	updateBook,
	getBookDownloadUrl,
	downloadBookFile,
};
