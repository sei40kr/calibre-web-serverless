import type { Book } from "@calibre-web-serverless/domain/models/book";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useEffect, useState } from "react";

/** The books being read, most recently read first, at most `limit` of them. */
export const useBooksInProgress = (userId: string, limit: number) => {
	const [books, setBooks] = useState<Book[]>([]);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!userId) {
			setBooks([]);
			return;
		}
		return bookRepository.subscribeToBooksInProgress(userId, {
			limit,
			onData: setBooks,
			onError: setError,
		});
	}, [userId, limit]);

	return { books, error };
};
