import { useEffect, useState } from "react";
import type { Series } from "@/models/series";
import { getAllSeries } from "@/services/seriesService";

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
