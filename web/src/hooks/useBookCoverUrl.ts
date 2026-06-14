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

		setLoading(true);
		bookCoverRepository
			.getCoverUrl(userId, bookId, { hasCover, hasCustomCover })
			.then((url) => {
				setCoverUrl(url);
				setLoading(false);
			})
			.catch(() => {
				setCoverUrl(null);
				setLoading(false);
			});
	}, [userId, bookId, hasCover, hasCustomCover, version]);

	return { coverUrl, loading };
};
