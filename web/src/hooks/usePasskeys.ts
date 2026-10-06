import type { Passkey } from "@calibre-web-serverless/domain/models/passkey";
import { passkeyService } from "@calibre-web-serverless/infrastructure/services/passkeyService";
import { useCallback, useEffect, useState } from "react";

/**
 * The signed-in user's passkeys. They live behind a callable rather than in
 * a client-readable collection, so this is a fetch, not a subscription:
 * call `reload` after adding or deleting one.
 */
export const usePasskeys = (userId: string) => {
	const [passkeys, setPasskeys] = useState<Passkey[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [version, setVersion] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `version` is the reload trigger, and a new user means a new list.
	useEffect(() => {
		let cancelled = false;
		setError(null);
		passkeyService
			.list()
			.then((data) => {
				if (cancelled) return;
				setPasskeys(data);
				setLoading(false);
			})
			.catch((err: Error) => {
				if (cancelled) return;
				setError(err);
				setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [userId, version]);

	const reload = useCallback(() => setVersion((v) => v + 1), []);

	return { passkeys, loading, error, reload };
};
