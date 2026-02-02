import type { Series } from "@calibre-web-serverless/domain/models/series";
import { getAllSeries } from "@calibre-web-serverless/infrastructure/services/seriesService";
import { useEffect, useState } from "react";

export const useSeries = (userId: string) => {
	const [series, setSeries] = useState<Series[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);

		getAllSeries(userId)
			.then((data) => {
				setSeries(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err);
				setLoading(false);
			});
	}, [userId]);

	return { series, loading, error };
};
