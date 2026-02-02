import type { Publisher } from "@calibre-web-serverless/domain/models/publisher";
import { publisherRepository } from "@calibre-web-serverless/infrastructure/repositories/publisherRepository";
import { useEffect, useState } from "react";

export const usePublishers = (userId: string) => {
	const [publishers, setPublishers] = useState<Publisher[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		publisherRepository
			.getAll(userId)
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
