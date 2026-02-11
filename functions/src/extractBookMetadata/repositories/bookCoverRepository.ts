import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions/v2";
import sharp from "sharp";

const MAX_COVER_WIDTH = 1024;

export async function uploadCover(
	bucketName: string,
	userId: string,
	bookId: string,
	coverImage: Buffer,
): Promise<string | null> {
	try {
		const pngBuffer = await sharp(coverImage)
			.resize({ width: MAX_COVER_WIDTH, withoutEnlargement: true })
			.png()
			.toBuffer();

		const coverPath = `users/${userId}/books/${bookId}/cover.png`;
		const bucket = getStorage().bucket(bucketName);
		const coverFile = bucket.file(coverPath);
		await coverFile.save(pngBuffer, {
			metadata: { contentType: "image/png" },
		});
		return "png";
	} catch (err) {
		logger.warn("Failed to process cover image", { error: err });
		return null;
	}
}
