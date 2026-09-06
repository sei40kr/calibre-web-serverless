import type { Book } from "@calibre-web-serverless/domain/models/book";
import {
	type BookFile,
	BookFileFormat,
} from "@calibre-web-serverless/domain/models/bookFile";
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
	BookFileDocument as BaseBookFileDocument,
	IdentifierDocument,
} from "../../documents/book";
import { extractedCoverPath } from "./bookCoverRepository";

// Admin-side access to books. Model <-> document conversion stays here so the
// firebase-admin Timestamp type never leaks out. File-scoped operations live
// in bookFileRepository.

type BookDocument = BaseBookDocument<Timestamp>;
type BookFileDocument = BaseBookFileDocument<Timestamp>;

// Catalog reads are limited to ready books: only they have a stored file and
// extracted metadata.
const READY_STATUS = "ready";

// A book is written with this status at upload, before metadata extraction runs.
// It only ever moves to "ready" or "error"; a book that stays "processing" is a
// stub whose extraction never completed (see the race note in the client
// uploadBook). Such stubs carry no author/series/tag/publisher relations, so
// deleting one needs no relation-count reconciliation.
const PROCESSING_STATUS = "processing";

const booksPath = (userId: string) => `users/${userId}/books`;
export const bookPath = (userId: string, bookId: string) =>
	`${booksPath(userId)}/${bookId}`;
export const bookFilePath = (userId: string, bookId: string, format: string) =>
	`${bookPath(userId, bookId)}/book.${format}`;

const toIdentifier = (doc: IdentifierDocument): Identifier => {
	const type = IdentifierType.from(doc.type);
	if (!type) throw new Error(`Unknown identifier type: ${doc.type}`);
	return { type, value: doc.value };
};

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

export function toBook(snapshot: DocumentSnapshot): Book {
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
		files: toBookFiles(d.files),
		hasCover: d.hasCover ?? false,
		hasCustomCover: d.hasCustomCover ?? false,
		status: d.status ?? "ready",
		errorCode: d.errorCode ?? null,
		createdAt: d.createdAt?.toDate() ?? null,
		updatedAt: d.updatedAt?.toDate() ?? null,
	};
}

// Omits `files`/`hasProcessingFile` so a metadata write can never clobber
// concurrent per-file state changes (those go through bookFileRepository).
function toBookDocument(book: Book): DocumentData {
	const document: Omit<
		BookDocument,
		"createdAt" | "updatedAt" | "files" | "hasProcessingFile"
	> & {
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
		hasCover: book.hasCover,
		hasCustomCover: book.hasCustomCover,
		status: book.status,
		errorCode: book.errorCode,
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

interface CreateSeededBookParams {
	userId: string;
	book: Omit<
		Book,
		| "id"
		| "userId"
		| "files"
		| "status"
		| "errorCode"
		| "createdAt"
		| "updatedAt"
	>;
	files: { data: Buffer; format: BookFileFormat; contentType: string }[];
	/** Already-normalized PNG (see web/scripts/prepareCoverFixture.ts). */
	coverPng: Buffer | null;
}

// Dev/test seeding only: creates a fully-described book that never goes
// through metadata extraction. The doc lands as "ready" (with its file
// entries already ready and entity counts incremented) *before* the Storage
// uploads, so the extraction trigger sees a ready book and short-circuits
// instead of parsing the files. No rollback on failure — a failed seed
// aborts the run.
export const createSeededBook = async ({
	userId,
	book,
	files,
	coverPng,
}: CreateSeededBookParams): Promise<{ bookId: string }> => {
	const bookId = crypto.randomUUID();
	const db = getFirestore();

	const batch = db.batch();
	batch.set(db.doc(bookPath(userId, bookId)), {
		...toBookDocument({
			...book,
			id: bookId,
			userId,
			files: [],
			status: "ready",
			errorCode: null,
			createdAt: null,
			updatedAt: null,
		}),
		files: Object.fromEntries(
			files.map((file) => [
				file.format,
				{
					fileSize: file.data.byteLength,
					status: "ready",
					errorCode: null,
					addedAt: FieldValue.serverTimestamp(),
				},
			]),
		),
		hasProcessingFile: false,
		createdAt: FieldValue.serverTimestamp(),
	});
	const increment = { bookCount: FieldValue.increment(1) };
	const entityRefs = [
		...book.authorIds.map((id) => `users/${userId}/authors/${id}`),
		...book.tagIds.map((id) => `users/${userId}/tags/${id}`),
		...(book.seriesId ? [`users/${userId}/series/${book.seriesId}`] : []),
		...(book.publisherId
			? [`users/${userId}/publishers/${book.publisherId}`]
			: []),
	];
	for (const path of entityRefs) {
		batch.update(db.doc(path), increment);
	}
	await batch.commit();

	const bucket = getStorage().bucket();
	for (const file of files) {
		await bucket
			.file(bookFilePath(userId, bookId, file.format))
			.save(file.data, { metadata: { contentType: file.contentType } });
	}
	if (coverPng) {
		await bucket.file(extractedCoverPath(userId, bookId)).save(coverPng, {
			metadata: { contentType: "image/png" },
		});
	}

	return { bookId };
};

/**
 * Every book across all users that has been stuck in "processing" since before
 * `olderThan` (compared on `updatedAt`, which a stub never advances). Uses a
 * collection-group query, so it needs the COLLECTION_GROUP index on
 * (status, updatedAt) declared in firestore.indexes.json.
 */
const findStaleProcessingBooks = async (olderThan: Date): Promise<Book[]> => {
	const snapshot = await getFirestore()
		.collectionGroup("books")
		.where("status", "==", PROCESSING_STATUS)
		.where("updatedAt", "<", Timestamp.fromDate(olderThan))
		.get();
	return snapshot.docs.map(toBook);
};

/**
 * Remove a book's Firestore document and every Storage object under its folder
 * (book file and any covers). Deleting by prefix keeps this idempotent and
 * self-healing regardless of which objects actually exist. Intended for
 * processing stubs, which have no relations to reconcile.
 */
const deleteBook = async (userId: string, bookId: string): Promise<void> => {
	await getFirestore().doc(bookPath(userId, bookId)).delete();
	await getStorage()
		.bucket()
		.deleteFiles({ prefix: `${bookPath(userId, bookId)}/` });
};

export const bookRepository = {
	countBooks,
	searchBooks,
	getBook,
	updateBook,
	findStaleProcessingBooks,
	deleteBook,
};
