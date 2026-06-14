import { MAX_COVER_WIDTH } from "@calibre-web-serverless/domain/models/bookCover";
import sharp from "sharp";

/**
 * Normalises a cover image to a size-bounded PNG. Images wider than
 * {@link MAX_COVER_WIDTH} are scaled down (aspect ratio preserved); smaller
 * images are left at their original dimensions. Shared by metadata extraction
 * and the custom-cover upload flow so both apply identical constraints.
 *
 * @throws if the buffer is not a decodable image (callers decide how to handle).
 */
export async function resizeCoverImage(coverImage: Buffer): Promise<Buffer> {
	return sharp(coverImage)
		.resize({ width: MAX_COVER_WIDTH, withoutEnlargement: true })
		.png()
		.toBuffer();
}
