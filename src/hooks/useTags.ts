import { useEffect, useState } from "react";
import type { Tag } from "@/models/tag";
import { getTags } from "@/services/tagService";

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
