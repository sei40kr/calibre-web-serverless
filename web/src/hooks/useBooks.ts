import type { Book } from "@calibre-web-serverless/domain/models/book";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useEffect, useState } from "react";

export const useBooks = (userId: string) => {
	const [books, setBooks] = useState<Book[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!userId) {
			setBooks([]);
			setLoading(false);
			return;
		}

		setLoading(true);

		const unsubscribe = bookRepository.subscribeToBooks(userId, {
			onData: (booksData) => {
				setBooks(booksData);
				setLoading(false);
			},
			onError: (err) => {
				setError(err);
				setLoading(false);
			},
		});

		return () => unsubscribe();
	}, [userId]);

	return { books, loading, error };
};
