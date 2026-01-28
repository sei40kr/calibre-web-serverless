import { useEffect, useState } from "react";
import type { Book } from "@/models/book";
import { getBook } from "@/services/bookService";

export const useBook = (userId: string, bookId: string) => {
	const [book, setBook] = useState<Book | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		getBook(userId, bookId)
			.then((bookData) => {
				setBook(bookData);
				setLoading(false);
			})
			.catch((err) => {
				setError(err);
				setLoading(false);
			});
	}, [userId, bookId]);

	return { book, loading, error };
};
