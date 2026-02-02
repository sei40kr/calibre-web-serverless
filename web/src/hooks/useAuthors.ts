import type { Author } from "@calibre-web-serverless/domain/models/author";
import { authorRepository } from "@calibre-web-serverless/infrastructure/repositories/authorRepository";
import { useEffect, useState } from "react";

export const useAuthors = (userId: string) => {
	const [authors, setAuthors] = useState<Author[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		authorRepository
			.getAll(userId)
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
