import type { BookFileFormat } from "@calibre-web-serverless/domain/models/bookFile";
import { bookFileRepository } from "@calibre-web-serverless/infrastructure/repositories/bookFileRepository";
import { useEffect, useState } from "react";

/**
 * Resolves the download URL of one stored format of a book. Pass
 * `enabled: false` until the format is known to exist so no doomed
 * request is made.
 */
export const useBookFileUrl = (
	userId: string,
	bookId: string,
	format: BookFileFormat,
	enabled: boolean,
) => {
	const [fileUrl, setFileUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!userId || !bookId || !enabled) {
			setFileUrl(null);
			setLoading(false);
			return;
		}

		let objectUrl: string | null = null;
		let active = true;
		setLoading(true);
		setError(null);

		bookFileRepository
			.getBookFileDownloadUrl(userId, bookId, format)
			.then((url) => {
				if (!active) {
					URL.revokeObjectURL(url);
					return;
				}
				objectUrl = url;
				setFileUrl(url);
				setLoading(false);
			})
			.catch((err: unknown) => {
				if (!active) return;
				setError(err instanceof Error ? err : new Error(String(err)));
				setLoading(false);
			});

		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [userId, bookId, format, enabled]);

	return { fileUrl, loading, error };
};
