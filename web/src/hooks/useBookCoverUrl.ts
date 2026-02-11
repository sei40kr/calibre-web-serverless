import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/repositories/bookCoverRepository";
import { useEffect, useState } from "react";

export const useBookCoverUrl = (
	userId: string,
	bookId: string,
	coverFormat: string | null,
) => {
	const [coverUrl, setCoverUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!coverFormat) {
			setCoverUrl(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		bookCoverRepository
			.getCoverUrl(userId, bookId, coverFormat)
			.then((url) => {
				setCoverUrl(url);
				setLoading(false);
			})
			.catch(() => {
				setCoverUrl(null);
				setLoading(false);
			});
	}, [userId, bookId, coverFormat]);

	return { coverUrl, loading };
};
