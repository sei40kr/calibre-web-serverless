import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { reconcileStaleProcessingBooks } from "./usecase";

// extractBookMetadata times out at 120s, so nothing legitimately stays in
// "processing" for more than a couple of minutes. A generous 60-minute floor
// guarantees we only ever reconcile genuinely stuck stubs, never an in-flight
// one.
const DEFAULT_OLDER_THAN_MINUTES = 60;

// Extraction (run inline when a stale stub still has its file) needs the same
// headroom as the extractBookMetadata trigger.
const RECONCILE_MEMORY = "512MiB";
const RECONCILE_TIMEOUT_SECONDS = 300;

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
 * Administrative endpoint that reconciles books stuck in "processing"
 * (reprocess if the file is present, delete otherwise). This is the manual
 * escape hatch; the scheduled reconcileStaleProcessingBooksFn below runs the
 * same usecase automatically.
 *
 * `invoker: "private"` removes the public allUsers binding, so only IAM
 * principals granted roles/run.invoker can call it — the CI service account
 * that the reconcile workflow authenticates as. This must never be made
 * allUsers-invokable: it mutates and destroys data.
 *
 * Query params:
 *   - olderThanMinutes: staleness threshold (default 60)
 *   - dryRun: "false" to actually reconcile; anything else (default) only reports.
 */
export const reconcileStaleProcessingBooksHttpFn = onRequest(
	{
		invoker: "private",
		memory: RECONCILE_MEMORY,
		timeoutSeconds: RECONCILE_TIMEOUT_SECONDS,
	},
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
			const result = await reconcileStaleProcessingBooks({ olderThan, dryRun });
			res.status(200).json(result);
		} catch (error) {
			logger.error("reconcileStaleProcessingBooksHttp request failed", {
				error,
			});
			res.status(500).json({
				error: error instanceof Error ? error.message : "reconcile failed",
			});
		}
	},
);

/**
 * Scheduled reconcile — the guaranteed net for stubs the client-side rollback
 * could not remove (e.g. the upload's connection died before the rollback
 * delete could reach Firestore). Runs every 15 minutes against the same
 * 60-minute staleness floor, which stays clear of any in-flight extraction.
 */
export const reconcileStaleProcessingBooksFn = onSchedule(
	{
		schedule: "every 15 minutes",
		memory: RECONCILE_MEMORY,
		timeoutSeconds: RECONCILE_TIMEOUT_SECONDS,
	},
	async () => {
		const olderThan = new Date(
			Date.now() - DEFAULT_OLDER_THAN_MINUTES * 60_000,
		);
		const result = await reconcileStaleProcessingBooks({
			olderThan,
			dryRun: false,
		});
		logger.info(
			"reconcileStaleProcessingBooks: scheduled run complete",
			result,
		);
	},
);
