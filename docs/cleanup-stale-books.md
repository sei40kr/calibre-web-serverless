# Cleaning up stale "processing" books

A book is written to Firestore with `status: "processing"` at upload time,
_before_ its file lands in Storage, to close a race with the
`extractBookMetadata` Cloud Function (see the note in the client `uploadBook`).
Extraction then flips the book to `ready` or `error`. If extraction never runs
to completion (e.g. the function read the stub before the write landed and
returned early), the book is left stuck in `processing` forever. Such a book is
an orphaned stub: it carries no author/series/tag/publisher relations and has no
usable metadata.

`extractBookMetadata` times out at 120s, so nothing legitimately stays in
`processing` for more than a couple of minutes.

## What runs the cleanup

- **`cleanupStaleProcessingBooks`** (`functions/src/cleanupStaleProcessingBooks/`)
  — an HTTP Cloud Function. It finds every book across all users whose `status`
  is `processing` and whose `updatedAt` is older than a threshold, then deletes
  the Firestore document and every Storage object under
  `users/{userId}/books/{bookId}/`. Deletes are best-effort per book.
  - `?olderThanMinutes=` — staleness threshold (default `60`).
  - `?dryRun=` — `false` to actually delete; anything else (**default**) only
    reports the matches.
  - The collection-group query needs the `COLLECTION_GROUP` index on
    `(status, updatedAt)` in `firestore.indexes.json`.
- **`.github/workflows/cleanup-stale-books.yml`** — a `workflow_dispatch` job
  that picks the environment (`staging` / `production`), authenticates via
  Workload Identity Federation as the `firebase-deploy` service account,
  resolves the deployed function URL, mints a Google-signed ID token for it, and
  `POST`s. Defaults to a dry run.

## How to run it

1. Deploy first if the function isn't live yet: run the **Deploy** workflow for
   the target environment (it ships `functions` and `firestore:indexes`).
2. Run the **Cleanup stale books** workflow:
   - `environment`: `staging` or `production`.
   - `olderThanMinutes`: leave at `60` unless you have a reason to change it.
   - `dryRun`: keep `true` first — the run logs exactly which books would be
     deleted. Re-run with `dryRun` unchecked to delete them.
