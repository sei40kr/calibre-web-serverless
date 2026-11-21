import type { OpdsApp } from "@calibre-web-serverless/domain/models/opdsApp";
import { opdsAppRepository } from "@calibre-web-serverless/infrastructure/repositories/opdsAppRepository";
import { useEffect, useState } from "react";

/** Live list of the OPDS apps the user allowed, newest first. */
export const useOpdsApps = (userId: string) => {
	const [opdsApps, setOpdsApps] = useState<OpdsApp[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setLoading(true);
		return opdsAppRepository.subscribeToOpdsApps(userId, {
			onData: (data) => {
				setOpdsApps(data);
				setLoading(false);
			},
			onError: (err) => {
				setError(err);
				setLoading(false);
			},
		});
	}, [userId]);

	return { opdsApps, loading, error };
};
