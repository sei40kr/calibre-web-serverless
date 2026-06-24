import type { Book } from "@calibre-web-serverless/domain/models/book";
import type {
	BookFilter,
	BookSort,
} from "@calibre-web-serverless/domain/models/bookQuery";
import { bookRepository } from "@calibre-web-serverless/infrastructure/repositories/bookRepository";
import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to the user's books, filtered and sorted server-side. The Firestore
 * query is rebuilt (and the subscription re-established) whenever `filter` or
 * `sort` change, so callers should pass stable references (e.g. memoised from
 * the URL) to avoid needless re-subscriptions.
 *
 * `loading` is only raised for the initial load of a given user, not when the
 * filter/sort change — re-subscribing keeps the previous results visible so the
 * surrounding UI (e.g. the filter toolbar/drawer) is not torn down and remounted
 * on every change.
 */
export const useBooks = (
	userId: string,
	filter?: BookFilter,
	sort?: BookSort,
) => {
	const [books, setBooks] = useState<Book[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const loadedUserRef = useRef<string | null>(null);

	useEffect(() => {
		if (!userId) {
			setBooks([]);
			setLoading(false);
			loadedUserRef.current = null;
			return;
		}

		// Show the loading state only the first time we load this user's library,
		// not on subsequent filter/sort changes.
		if (loadedUserRef.current !== userId) {
			loadedUserRef.current = userId;
			setLoading(true);
		}

		const unsubscribe = bookRepository.subscribeToBooks(userId, {
			filter,
			sort,
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
	}, [userId, filter, sort]);

	return { books, loading, error };
};
