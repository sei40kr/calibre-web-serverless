import { onObjectFinalized } from "firebase-functions/v2/storage";
import { resizeBookCover } from "./usecase";

/**
 * Matches the raw custom-cover upload path
 * `users/{userId}/books/{bookId}/cover_upload.{ext}`. Deliberately does NOT
 * match the processed outputs (`cover.*`, `custom_cover.png`) so the function
 * never re-triggers on its own writes.
 */
export function parseCoverUploadPath(
	name: string,
): { userId: string; bookId: string; ext: string } | null {
	const match = name.match(
		/^users\/([^/]+)\/books\/([^/]+)\/cover_upload\.([^/]+)$/,
	);
	if (!match) return null;
	return { userId: match[1], bookId: match[2], ext: match[3] };
}

export const resizeBookCoverFn = onObjectFinalized(
	{ memory: "512MiB", timeoutSeconds: 120 },
	async (event) => {
		const { name, size } = event.data;
		if (!name) return;

		const parsed = parseCoverUploadPath(name);
		if (!parsed) return;

		await resizeBookCover({
			userId: parsed.userId,
			bookId: parsed.bookId,
			ext: parsed.ext,
			size: typeof size === "number" ? size : Number(size) || undefined,
		});
	},
);
