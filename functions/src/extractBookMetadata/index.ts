import { onObjectFinalized } from "firebase-functions/v2/storage";
import { extractBookMetadata } from "./usecase";

export function parseStoragePath(
	name: string,
): { userId: string; bookId: string; format: string } | null {
	const match = name.match(/^users\/([^/]+)\/books\/([^/]+)\/book\.([^/]+)$/);
	if (!match) return null;
	return { userId: match[1], bookId: match[2], format: match[3] };
}

export const extractBookMetadataFn = onObjectFinalized(
	{ memory: "512MiB", timeoutSeconds: 120 },
	async (event) => {
		const { name, metadata } = event.data;
		if (!name) return;

		const parsed = parseStoragePath(name);
		if (!parsed) return;

		await extractBookMetadata({
			originalName: metadata?.originalName,
			...parsed,
		});
	},
);
