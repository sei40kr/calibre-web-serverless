import type { Book } from "@calibre-web-serverless/domain/models/book";
import { hasAnyCover } from "@calibre-web-serverless/domain/repositories/bookCoverRepository";
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
			initial[book.id] = { coverUrl: null, loading: hasAnyCover(book) };
		}
		setCoverInfos(initial);

		for (const book of books) {
			if (!hasAnyCover(book)) continue;

			bookCoverRepository
				.getCoverUrl(book.userId, book.id, book)
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
