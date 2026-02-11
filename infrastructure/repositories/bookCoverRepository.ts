import type { BookCoverRepository } from "@calibre-web-serverless/domain/repositories/bookCoverRepository";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../lib/firebase";

const contentTypeMap: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};

const getCoverUrl = async (
	userId: string,
	bookId: string,
	coverFormat: string,
): Promise<string> => {
	const storageRef = ref(
		storage,
		`users/${userId}/books/${bookId}/cover.${coverFormat}`,
	);
	return getDownloadURL(storageRef);
};

const uploadCover = async ({
	userId,
	bookId,
	file,
}: {
	userId: string;
	bookId: string;
	file: File;
}): Promise<void> => {
	const ext = file.name.split(".").pop() ?? "";
	const storageRef = ref(
		storage,
		`users/${userId}/books/${bookId}/cover.${ext}`,
	);
	const contentType = contentTypeMap[ext] ?? "application/octet-stream";
	await uploadBytes(storageRef, file, { contentType });
	// TODO
};

export const bookCoverRepository: BookCoverRepository = {
	getCoverUrl,
	uploadCover,
};
