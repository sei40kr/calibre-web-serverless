import { useEffect, useState } from "react";
import type { Publisher } from "@/models/publisher";
import { getPublishers } from "@/services/publisherService";

export const usePublishers = (userId: string) => {
	const [publishers, setPublishers] = useState<Publisher[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		getPublishers(userId)
			.then((data) => {
				setPublishers(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err);
				setLoading(false);
			});
	}, [userId]);

	return { publishers, loading, error };
};
