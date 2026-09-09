import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/repositories/bookCoverRepository";
import { useEffect, useState } from "react";

export const useBookCoverUrl = (
	userId: string,
	bookId: string,
	hasCover: boolean,
	hasCustomCover: boolean,
	/**
	 * Bump to force a re-fetch when the cover image changes at a stable path
	 * (e.g. a replaced custom cover). Pass the book's updatedAt epoch.
	 */
	version?: number,
) => {
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// `version` is intentional: it is unused inside the effect but, when bumped,
	// forces a re-fetch so a replaced custom cover (same storage path) refreshes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: version is a deliberate refresh trigger
	useEffect(() => {
		if (!hasCustomCover && !hasCover) {
			setCoverUrl(null);
			setLoading(false);
			return;
		}

		let objectUrl: string | null = null;
		let active = true;

		setLoading(true);
		bookCoverRepository
			.getCoverUrl(userId, bookId, { hasCover, hasCustomCover })
			.then((url) => {
				if (!active) {
					URL.revokeObjectURL(url);
					return;
				}
				objectUrl = url;
				setCoverUrl(url);
				setLoading(false);
			})
			.catch(() => {
				if (!active) return;
				setCoverUrl(null);
				setLoading(false);
			});

		return () => {
			active = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [userId, bookId, hasCover, hasCustomCover, version]);

	return { coverUrl, loading };
};
