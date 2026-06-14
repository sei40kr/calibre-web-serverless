import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

/**
 * Flips the book's `hasCustomCover` flag so the client switches to displaying
 * the custom cover. `updatedAt` is bumped so the UI can detect the change and
 * refresh the (same-path) cover image.
 */
export async function setHasCustomCover(
	userId: string,
	bookId: string,
	hasCustomCover: boolean,
): Promise<void> {
	const db = getFirestore();
	const bookRef = db.doc(`users/${userId}/books/${bookId}`);
	try {
		await bookRef.update({
			hasCustomCover,
			updatedAt: FieldValue.serverTimestamp(),
		});
	} catch (err) {
		// The book doc may have been deleted before the resize finished.
		logger.warn("Failed to update hasCustomCover", { userId, bookId, err });
	}
}
