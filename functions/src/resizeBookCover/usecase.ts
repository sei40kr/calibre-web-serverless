import { MAX_COVER_UPLOAD_BYTES } from "@calibre-web-serverless/domain/models/bookCover";
import { logger } from "firebase-functions/v2";
import {
	deleteUpload,
	downloadUpload,
	saveCustomCover,
} from "./repositories/bookCoverRepository";
import { setHasCustomCover } from "./repositories/bookRepository";

export interface ResizeBookCoverParams {
	bucketName: string;
	userId: string;
	bookId: string;
	storagePath: string;
	/** Object size in bytes, as reported by the Storage event (if known). */
	size?: number;
}

/**
 * Resizes a user-uploaded raw cover into the book's custom cover. The raw upload
 * is always removed afterwards (success or failure) so staging objects never
 * linger. An oversized or undecodable upload is dropped without flipping the
 * custom-cover flag.
 */
export async function resizeBookCover(
	params: ResizeBookCoverParams,
): Promise<void> {
	const { bucketName, userId, bookId, storagePath, size } = params;

	try {
		if (size !== undefined && size > MAX_COVER_UPLOAD_BYTES) {
			logger.warn("Rejected oversized cover upload", {
				userId,
				bookId,
				size,
				limit: MAX_COVER_UPLOAD_BYTES,
			});
			return;
		}

		const uploadBuffer = await downloadUpload(bucketName, storagePath);

		if (uploadBuffer.byteLength > MAX_COVER_UPLOAD_BYTES) {
			logger.warn("Rejected oversized cover upload", {
				userId,
				bookId,
				size: uploadBuffer.byteLength,
				limit: MAX_COVER_UPLOAD_BYTES,
			});
			return;
		}

		await saveCustomCover(bucketName, userId, bookId, uploadBuffer);
		await setHasCustomCover(userId, bookId, true);

		logger.info(`Applied custom cover for book ${bookId}`, { userId });
	} catch (error) {
		logger.error("Failed to resize custom cover", { userId, bookId, error });
	} finally {
		await deleteUpload(bucketName, storagePath);
	}
}
