import type { Bookshelf } from "@calibre-web-serverless/domain/models/bookshelf";
import { bookshelfRepository } from "@calibre-web-serverless/infrastructure/repositories/bookshelfRepository";
import { useEffect, useState } from "react";

/** Live list of the user's bookshelves, sorted by name. */
export const useBookshelves = (userId: string) => {
	const [bookshelves, setBookshelves] = useState<Bookshelf[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		if (!userId) {
			setBookshelves([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		const unsubscribe = bookshelfRepository.subscribeToBookshelves(userId, {
			onData: (data) => {
				setBookshelves(data);
				setLoading(false);
			},
			onError: (err) => {
				setError(err);
				setLoading(false);
			},
		});

		return () => unsubscribe();
	}, [userId]);

	return { bookshelves, loading, error };
};
