import { useEffect, useState } from "react";
import type { Book } from "@/models/book";
import { subscribeToBooks } from "@/services/bookService";

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
