import { MAX_COVER_UPLOAD_BYTES } from "@calibre-web-serverless/domain/models/bookCover";
import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/admin/repositories/bookCoverRepository";
import { logger } from "firebase-functions/v2";

export interface ResizeBookCoverParams {
	userId: string;
	bookId: string;
	/** Extension of the raw upload object (`cover_upload.{ext}`). */
	ext: string;
	/** Object size in bytes, as reported by the Storage event (if known). */
	size?: number;
}

/**
 * Resizes a user-uploaded raw cover into the book's custom cover. The raw upload
 * is always removed afterwards (success or failure) so staging objects never
 * linger. An oversized or undecodable upload is dropped without activating a
 * custom cover.
 */
export async function resizeBookCover(
	params: ResizeBookCoverParams,
): Promise<void> {
	const { userId, bookId, ext, size } = params;

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

		const uploadBuffer = await bookCoverRepository.downloadCoverUpload(
			userId,
			bookId,
			ext,
		);

		if (uploadBuffer.byteLength > MAX_COVER_UPLOAD_BYTES) {
			logger.warn("Rejected oversized cover upload", {
				userId,
				bookId,
				size: uploadBuffer.byteLength,
				limit: MAX_COVER_UPLOAD_BYTES,
			});
			return;
		}

		await bookCoverRepository.saveCustomCover(userId, bookId, uploadBuffer);
		logger.info(`Applied custom cover for book ${bookId}`, { userId });
	} catch (error) {
		logger.error("Failed to resize custom cover", { userId, bookId, error });
	} finally {
		await bookCoverRepository.deleteCoverUpload(userId, bookId, ext);
	}
}
