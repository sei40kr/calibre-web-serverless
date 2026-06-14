/**
 * Shared constraints for book cover images. Imported by the web client (upload
 * validation), the Storage security rules' counterpart in code, and the Cloud
 * Functions that resize covers, so the limits stay in lockstep across layers.
 */

/** Maximum size of a user-uploaded custom cover, in bytes (10 MiB). */
export const MAX_COVER_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Maximum width covers are resized to. Larger images are scaled down to this
 * width (aspect ratio preserved); smaller images are left untouched. Applied to
 * both metadata-extracted covers and user-uploaded custom covers.
 */
export const MAX_COVER_WIDTH = 1024;

/** Image MIME types accepted for custom cover uploads. */
export const ACCEPTED_COVER_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

export type AcceptedCoverMimeType = (typeof ACCEPTED_COVER_MIME_TYPES)[number];

/** `accept` attribute value for a file input that takes cover images. */
export const COVER_UPLOAD_ACCEPT = ACCEPTED_COVER_MIME_TYPES.join(",");

export function isAcceptedCoverMimeType(
	mimeType: string,
): mimeType is AcceptedCoverMimeType {
	return (ACCEPTED_COVER_MIME_TYPES as readonly string[]).includes(mimeType);
}
