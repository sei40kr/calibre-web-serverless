import {
	ACCEPTED_COVER_MIME_TYPES,
	isAcceptedCoverMimeType,
	MAX_COVER_UPLOAD_BYTES,
} from "@calibre-web-serverless/domain/models/bookCover";
import type {
	BookCoverRepository,
	CoverRef,
} from "@calibre-web-serverless/domain/repositories/bookCoverRepository";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
	deleteObject,
	getDownloadURL,
	ref,
	uploadBytes,
} from "firebase/storage";
import { db, storage } from "../lib/firebase";

// Covers are normalised to PNG (server-side by Cloud Functions), so the active
// cover is always one of these two fixed paths.
const coverPath = (
	userId: string,
	bookId: string,
	coverRef: CoverRef,
): string => {
	const base = `users/${userId}/books/${bookId}`;
	return coverRef.hasCustomCover
		? `${base}/custom_cover.png`
		: `${base}/cover.png`;
};

const mimeToExtension: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

const getCoverUrl = async (
	userId: string,
	bookId: string,
	coverRef: CoverRef,
): Promise<string> => {
	if (!coverRef.hasCustomCover && !coverRef.hasCover) {
		throw new Error("Book has no cover image");
	}
	const storageRef = ref(storage, coverPath(userId, bookId, coverRef));
	return getDownloadURL(storageRef);
};

const uploadCustomCover = async ({
	userId,
	bookId,
	file,
}: {
	userId: string;
	bookId: string;
	file: File;
}): Promise<void> => {
	if (!isAcceptedCoverMimeType(file.type)) {
		throw new Error(
			`Unsupported image type. Allowed: ${ACCEPTED_COVER_MIME_TYPES.join(", ")}`,
		);
	}
	if (file.size > MAX_COVER_UPLOAD_BYTES) {
		throw new Error("Image is too large");
	}

	const ext = mimeToExtension[file.type] ?? "img";
	const storageRef = ref(
		storage,
		`users/${userId}/books/${bookId}/cover_upload.${ext}`,
	);
	await uploadBytes(storageRef, file, { contentType: file.type });
	// A Cloud Function (resizeBookCover) picks up the upload, writes the resized
	// custom_cover.png, flips hasCustomCover, and removes this staging object.
};

const resetCustomCover = async ({
	userId,
	bookId,
}: {
	userId: string;
	bookId: string;
}): Promise<void> => {
	await deleteObject(
		ref(storage, `users/${userId}/books/${bookId}/custom_cover.png`),
	).catch(() => {
		// Ignore a missing custom cover so reset stays idempotent.
	});
	await updateDoc(doc(db, "users", userId, "books", bookId), {
		hasCustomCover: false,
		updatedAt: serverTimestamp(),
	});
};

export const bookCoverRepository: BookCoverRepository = {
	getCoverUrl,
	uploadCustomCover,
	resetCustomCover,
};
