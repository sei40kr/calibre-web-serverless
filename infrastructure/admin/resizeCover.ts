import {
	MAX_COVER_INPUT_PIXELS,
	MAX_COVER_WIDTH,
} from "@calibre-web-serverless/domain/models/bookCover";
import sharp from "sharp";

/**
 * Normalises a cover image to a size-bounded PNG. Images wider than
 * {@link MAX_COVER_WIDTH} are scaled down (aspect ratio preserved); smaller
 * images are left at their original dimensions. Shared by metadata extraction
 * and the custom-cover upload flow so both apply identical constraints.
 *
 * @throws if the buffer is not a decodable image, or decodes to more than
 * {@link MAX_COVER_INPUT_PIXELS} pixels (callers decide how to handle).
 */
export async function resizeCoverImage(coverImage: Buffer): Promise<Buffer> {
	return sharp(coverImage, { limitInputPixels: MAX_COVER_INPUT_PIXELS })
		.resize({ width: MAX_COVER_WIDTH, withoutEnlargement: true })
		.png()
		.toBuffer();
}
