import type { Book } from "@calibre-web-serverless/domain/models/book";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useEffect, useState } from "react";

export const useBook = (userId: string, bookId: string) => {
	const [book, setBook] = useState<Book | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		bookRepository
			.getBook(userId, bookId)
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
