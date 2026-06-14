import type { Book } from "@calibre-web-serverless/domain/models/book";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useEffect, useState } from "react";

export const useBook = (userId: string, bookId: string) => {
	const [book, setBook] = useState<Book | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!userId || !bookId) return;

		let active = true;
		setLoading(true);
		setError(null);

		bookRepository
			.getBook(userId, bookId)
			.then((bookData) => {
				if (!active) return;
				setBook(bookData);
				setLoading(false);
			})
			.catch((err) => {
				if (!active) return;
				setError(err);
				setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [userId, bookId]);

	return { book, loading, error };
};
