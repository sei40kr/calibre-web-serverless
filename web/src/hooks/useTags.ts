import type { Tag } from "@calibre-web-serverless/domain/models/tag";
import { getTags } from "@calibre-web-serverless/infrastructure/services/tagService";
import { useEffect, useState } from "react";

export const useTags = (userId: string) => {
	const [tags, setTags] = useState<Tag[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		getTags(userId)
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
