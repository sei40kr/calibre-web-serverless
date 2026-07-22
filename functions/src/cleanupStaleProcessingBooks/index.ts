import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { cleanupStaleProcessingBooks } from "./usecase";

// extractBookMetadata times out at 120s, so nothing legitimately stays in
// "processing" for more than a couple of minutes. A generous 60-minute floor
// guarantees we only ever delete genuinely stuck stubs, never an in-flight one.
const DEFAULT_OLDER_THAN_MINUTES = 60;

function parsePositiveInt(value: unknown, fallback: number): number {
	const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
	if (value === "true") return true;
	if (value === "false") return false;
	return fallback;
}

/**
 * Administrative endpoint that deletes books stuck in "processing".
 *
 * `invoker: "private"` removes the public allUsers binding, so only IAM
 * principals granted roles/run.invoker can call it — the CI service account
 * that the cleanup workflow authenticates as. This must never be made
 * allUsers-invokable: it destroys data.
 *
 * Query params:
 *   - olderThanMinutes: staleness threshold (default 60)
 *   - dryRun: "false" to actually delete; anything else (default) only reports.
 */
export const cleanupStaleProcessingBooksFn = onRequest(
	{ invoker: "private", memory: "256MiB", timeoutSeconds: 300 },
	async (req, res) => {
		if (req.method !== "POST") {
			res.set("Allow", "POST").status(405).end();
			return;
		}

		const olderThanMinutes = parsePositiveInt(
			req.query.olderThanMinutes,
			DEFAULT_OLDER_THAN_MINUTES,
		);
		// Default to a dry run so an accidental call reports without deleting.
		const dryRun = parseBoolean(req.query.dryRun, true);
		const olderThan = new Date(Date.now() - olderThanMinutes * 60_000);

		try {
			const result = await cleanupStaleProcessingBooks({ olderThan, dryRun });
			res.status(200).json(result);
		} catch (error) {
			logger.error("cleanupStaleProcessingBooks request failed", { error });
			res.status(500).json({
				error: error instanceof Error ? error.message : "cleanup failed",
			});
		}
	},
);
