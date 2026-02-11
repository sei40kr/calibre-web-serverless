import type { Book } from "@calibre-web-serverless/domain/models/book";
import { bookCoverRepository } from "@calibre-web-serverless/infrastructure/repositories/bookCoverRepository";
import { useEffect, useState } from "react";

interface BookCoverInfo {
	coverUrl: string | null;
	loading: boolean;
}

export const useBookCoverUrls = (
	books: Book[],
): Record<string, BookCoverInfo> => {
	const [coverInfos, setCoverInfos] = useState<Record<string, BookCoverInfo>>(
		{},
	);

	useEffect(() => {
		const initial: Record<string, BookCoverInfo> = {};
		for (const book of books) {
			initial[book.id] = { coverUrl: null, loading: !!book.coverFormat };
		}
		setCoverInfos(initial);

		for (const book of books) {
			if (!book.coverFormat) continue;

			bookCoverRepository
				.getCoverUrl(book.userId, book.id, book.coverFormat)
				.then((url) => {
					setCoverInfos((prev) => ({
						...prev,
						[book.id]: { coverUrl: url, loading: false },
					}));
				})
				.catch(() => {
					setCoverInfos((prev) => ({
						...prev,
						[book.id]: { coverUrl: null, loading: false },
					}));
				});
		}
	}, [books]);

	return coverInfos;
};
