import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import { resizeCoverImage } from "../../shared/resizeCover";

/** Resizes and stores the extracted cover as cover.png. Returns whether it saved. */
export async function uploadCover(
	bucketName: string,
	userId: string,
	bookId: string,
	coverImage: Buffer,
): Promise<boolean> {
	try {
		const pngBuffer = await resizeCoverImage(coverImage);

		const coverPath = `users/${userId}/books/${bookId}/cover.png`;
		const bucket = getStorage().bucket(bucketName);
		const coverFile = bucket.file(coverPath);
		await coverFile.save(pngBuffer, {
			metadata: { contentType: "image/png" },
		});
		return true;
	} catch (err) {
		logger.warn("Failed to process cover image", { error: err });
		return false;
	}
}
