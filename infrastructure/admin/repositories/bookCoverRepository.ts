import type { CoverRef } from "@calibre-web-serverless/domain/repositories/bookCoverRepository";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { resizeCoverImage } from "../resizeCover";

// Admin-side access to book cover images. Covers are always stored as PNG:
//   cover.png         metadata-extracted cover    (hasCover)
//   custom_cover.png  user-uploaded custom cover  (hasCustomCover)
//   cover_upload.*    raw upload staging, removed after resize
// The custom cover takes precedence over the extracted one — that selection is
// expressed by the CoverRef the caller passes in (mirrors the client
// bookCoverRepository), not decided here.

const DOWNLOAD_URL_TTL_MS = 15 * 60 * 1000;

const bookPath = (userId: string, bookId: string) =>
	`users/${userId}/books/${bookId}`;
export const extractedCoverPath = (userId: string, bookId: string) =>
	`${bookPath(userId, bookId)}/cover.png`;
const customCoverPath = (userId: string, bookId: string) =>
	`${bookPath(userId, bookId)}/custom_cover.png`;
const coverUploadPath = (userId: string, bookId: string, ext: string) =>
	`${bookPath(userId, bookId)}/cover_upload.${ext}`;

// The active cover path implied by the CoverRef.
const activeCoverPath = (userId: string, bookId: string, ref: CoverRef) =>
	ref.hasCustomCover
		? customCoverPath(userId, bookId)
		: extractedCoverPath(userId, bookId);

/** A short-lived signed URL for the book's active cover. */
const getCoverUrl = async (
	userId: string,
	bookId: string,
	ref: CoverRef,
): Promise<string> => {
	const file = getStorage()
		.bucket()
		.file(activeCoverPath(userId, bookId, ref));
	const [url] = await file.getSignedUrl({
		action: "read",
		expires: Date.now() + DOWNLOAD_URL_TTL_MS,
	});
	return url;
};

/** The active cover bytes (used when streaming through the function). */
const downloadCover = async (
	userId: string,
	bookId: string,
	ref: CoverRef,
): Promise<Buffer> => {
	const [buffer] = await getStorage()
		.bucket()
		.file(activeCoverPath(userId, bookId, ref))
		.download();
	return buffer;
};

/** Resize and store an extracted cover (cover.png). Returns whether it saved. */
const saveExtractedCover = async (
	userId: string,
	bookId: string,
	image: Buffer,
): Promise<boolean> => {
	try {
		const png = await resizeCoverImage(image);
		await getStorage()
			.bucket()
			.file(extractedCoverPath(userId, bookId))
			.save(png, { metadata: { contentType: "image/png" } });
		return true;
	} catch (err) {
		logger.warn("Failed to process cover image", { error: err });
		return false;
	}
};

/** Download a raw custom-cover upload. */
const downloadCoverUpload = async (
	userId: string,
	bookId: string,
	ext: string,
): Promise<Buffer> => {
	const [buffer] = await getStorage()
		.bucket()
		.file(coverUploadPath(userId, bookId, ext))
		.download();
	return buffer;
};

/**
 * Resize a raw upload into the book's custom cover and activate it: stores
 * custom_cover.png and flips hasCustomCover together (mirrors the client's
 * resetCustomCover, which clears both). The extracted cover.png is left intact
 * so a later reset can restore it.
 */
const saveCustomCover = async (
	userId: string,
	bookId: string,
	image: Buffer,
): Promise<void> => {
	const png = await resizeCoverImage(image);
	await getStorage()
		.bucket()
		.file(customCoverPath(userId, bookId))
		.save(png, { metadata: { contentType: "image/png" } });
	await getFirestore().doc(bookPath(userId, bookId)).update({
		hasCustomCover: true,
		updatedAt: FieldValue.serverTimestamp(),
	});
};

/** Best-effort removal of the raw upload staging object. */
const deleteCoverUpload = async (
	userId: string,
	bookId: string,
	ext: string,
): Promise<void> => {
	await getStorage()
		.bucket()
		.file(coverUploadPath(userId, bookId, ext))
		.delete()
		.catch(() => {
			// Best effort: the raw upload may already be gone on retries.
		});
};

export const bookCoverRepository = {
	getCoverUrl,
	downloadCover,
	saveExtractedCover,
	downloadCoverUpload,
	saveCustomCover,
	deleteCoverUpload,
};
