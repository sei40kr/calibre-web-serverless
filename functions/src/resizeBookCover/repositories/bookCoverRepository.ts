import { getStorage } from "firebase-admin/storage";
import { resizeCoverImage } from "../../shared/resizeCover";

export async function downloadUpload(
	bucketName: string,
	storagePath: string,
): Promise<Buffer> {
	const bucket = getStorage().bucket(bucketName);
	const [buffer] = await bucket.file(storagePath).download();
	return buffer;
}

/**
 * Resizes the raw upload and stores it as the book's custom cover
 * (`custom_cover.png`). The metadata-extracted `cover.*` is left untouched so it
 * can be restored when the user resets.
 */
export async function saveCustomCover(
	bucketName: string,
	userId: string,
	bookId: string,
	coverImage: Buffer,
): Promise<void> {
	const pngBuffer = await resizeCoverImage(coverImage);

	const coverPath = `users/${userId}/books/${bookId}/custom_cover.png`;
	const bucket = getStorage().bucket(bucketName);
	await bucket.file(coverPath).save(pngBuffer, {
		metadata: { contentType: "image/png" },
	});
}

export async function deleteUpload(
	bucketName: string,
	storagePath: string,
): Promise<void> {
	const bucket = getStorage().bucket(bucketName);
	await bucket
		.file(storagePath)
		.delete()
		.catch(() => {
			// Best effort: the raw upload may already be gone on retries.
		});
}
