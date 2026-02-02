import type { Book } from "@calibre-web-serverless/domain/models/book";
import { subscribeToBooks } from "@calibre-web-serverless/infrastructure/services/bookService";
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

		const unsubscribe = subscribeToBooks(userId, {
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
