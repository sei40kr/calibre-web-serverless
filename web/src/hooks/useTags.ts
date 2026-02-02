import type { Tag } from "@calibre-web-serverless/domain/models/tag";
import { tagRepository } from "@calibre-web-serverless/infrastructure/repositories/tagRepository";
import { useEffect, useState } from "react";

export const useTags = (userId: string) => {
	const [tags, setTags] = useState<Tag[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		tagRepository
			.getAll(userId)
			.then((data) => {
				setTags(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err);
				setLoading(false);
			});
	}, [userId]);

	return { tags, loading, error };
};
