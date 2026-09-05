/**
 * One-shot migration to the multi-format book schema: converts the legacy
 * `format`/`fileSize`/`errorMessage` fields into the `files` map plus
 * `hasProcessingFile` and `errorCode`. Storage objects already live at
 * book.<format> and need no move. Idempotent: documents that already have
 * `files` are skipped.
 *
 * Usage (production):
 *   GOOGLE_APPLICATION_CREDENTIALS=<key.json> bun run scripts/migrateBookFiles.ts [--dry-run]
 * Usage (emulator):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-project \
 *     bun run scripts/migrateBookFiles.ts [--dry-run]
 */

import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const dryRun = process.argv.includes("--dry-run");

async function main() {
	initializeApp();
	const db = getFirestore();
	const snapshot = await db.collectionGroup("books").get();

	let migrated = 0;
	let skipped = 0;
	for (const doc of snapshot.docs) {
		const data = doc.data();
		if (data.files) {
			skipped++;
			continue;
		}

		const format =
			typeof data.format === "string" && data.format !== ""
				? data.format.toLowerCase()
				: null;
		// The single legacy file inherits the book's status, so a stuck
		// processing/error stub keeps its meaning for the reconcile job.
		const status = data.status ?? "ready";
		const errorCode = status === "error" ? "extraction-failed" : null;
		const files = format
			? {
					[format]: {
						fileSize: data.fileSize ?? 0,
						status,
						errorCode,
						addedAt: data.createdAt ?? null,
					},
				}
			: {};

		console.log(
			`${dryRun ? "[dry-run] would migrate" : "migrating"} ${doc.ref.path} (${format ?? "no file"})`,
		);
		if (!dryRun) {
			await doc.ref.update({
				files,
				hasProcessingFile: format !== null && status === "processing",
				errorCode,
				format: FieldValue.delete(),
				fileSize: FieldValue.delete(),
				errorMessage: FieldValue.delete(),
			});
		}
		migrated++;
	}

	console.log(
		`[migrateBookFiles] done: ${migrated} migrated, ${skipped} already migrated${dryRun ? " (dry run)" : ""}`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[migrateBookFiles] Error:", err);
		process.exit(1);
	});
