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

		// The subscription never fires for a missing document, so a one-shot get
		// resolves the not-found case; the subscription then keeps the book live.
		bookRepository
			.getBook(userId, bookId)
			.then((bookData) => {
				if (!active) return;
				setBook((current) => current ?? bookData);
				setLoading(false);
			})
			.catch((err) => {
				if (!active) return;
				setError(err);
				setLoading(false);
			});

		const unsubscribe = bookRepository.subscribeToBook(userId, bookId, {
			onData: (bookData) => {
				if (!active) return;
				setBook(bookData);
				setLoading(false);
			},
			onError: (err) => {
				if (!active) return;
				setError(err);
				setLoading(false);
			},
		});

		return () => {
			active = false;
			unsubscribe();
		};
	}, [userId, bookId]);

	return { book, loading, error };
};
