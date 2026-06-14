import type { Identifier } from "@calibre-web-serverless/domain/models/identifier";
import type { Language } from "@calibre-web-serverless/domain/models/language";
import type { BookDocument } from "@calibre-web-serverless/firestore-documents/book";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";

export async function downloadBookFile(
	bucketName: string,
	storagePath: string,
): Promise<Buffer> {
	const bucket = getStorage().bucket(bucketName);
	const [fileBuffer] = await bucket.file(storagePath).download();
	return fileBuffer;
}

export async function updateBookMetadata(
	userId: string,
	bookId: string,
	data: {
		title: string | null;
		authorIds: string[];
		publisherId: string | null;
		description: string | null;
		languages: Language[];
		identifiers: Identifier[];
		hasCover: boolean;
		pubDate: Date | null;
	},
): Promise<void> {
	const db = getFirestore();
	const updateData: Partial<Omit<BookDocument<Timestamp>, "updatedAt">> & {
		updatedAt: FieldValue;
	} = {
		// title is non-nullable on the document; an unextracted title becomes empty.
		title: data.title ?? "",
		authorIds: data.authorIds,
		publisherId: data.publisherId,
		description: data.description,
		languages: data.languages.map((language) => language.code),
		identifiers: data.identifiers.map((identifier) => ({
			type: identifier.type.value,
			value: identifier.value,
		})),
		hasCover: data.hasCover,
		pubDate: data.pubDate ? Timestamp.fromDate(data.pubDate) : null,
		status: "ready",
		errorMessage: null,
		updatedAt: FieldValue.serverTimestamp(),
	};

	const bookRef = db.doc(`users/${userId}/books/${bookId}`);
	await bookRef.update(updateData);
}

export async function setBookError(
	userId: string,
	bookId: string,
	errorMessage: string,
): Promise<void> {
	const db = getFirestore();
	const bookRef = db.doc(`users/${userId}/books/${bookId}`);
	try {
		await bookRef.update({
			status: "error",
			errorMessage,
			updatedAt: FieldValue.serverTimestamp(),
		});
	} catch (err) {
		// The book doc may have been deleted before processing finished; log and
		// swallow so we don't surface an unhandled rejection from the error path.
		logger.warn("Failed to record book error status", { userId, bookId, err });
	}
}
