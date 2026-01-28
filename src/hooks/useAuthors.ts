import { useEffect, useState } from "react";
import type { Author } from "@/models/author";
import { getAuthors } from "@/services/authorService";

export const useAuthors = (userId: string) => {
	const [authors, setAuthors] = useState<Author[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		getAuthors(userId)
			.then((data) => {
				setAuthors(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err);
				setLoading(false);
			});
	}, [userId]);

	return { authors, loading, error };
};
