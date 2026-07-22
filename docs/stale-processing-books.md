# Reconciling stale "processing" books

A book is written to Firestore with `status: "processing"` at upload time,
_before_ its file lands in Storage, to close a race with the
`extractBookMetadata` Cloud Function (see the note in the client `uploadBook`).
Extraction then flips the book to `ready` or `error`. A book can nonetheless get
stuck in `processing` forever in two ways:

- **File present, extraction never ran** — e.g. the function read the stub
  before the write landed and returned early. The upload itself succeeded, so
  the book is recoverable.
- **File never landed** — the client created the stub but the Storage upload was
  interrupted (a backgrounded mobile tab or lost signal freezing the page's JS
  before the upload finished). The client attempts a best-effort rollback, but
  if the connection is what failed, that rollback delete cannot reach Firestore
  either. Nothing is recoverable — the stub is orphaned.

`extractBookMetadata` times out at 120s, so nothing legitimately stays in
`processing` for more than a couple of minutes.

## Reconcile behaviour

The reconcile handles each stale `processing` book by whether its file made it
to Storage:

- **file present** → re-run `extractBookMetadata` to recover the book (rather
  than discard an intact upload);
- **file absent** → delete the Firestore document and every Storage object under
  `users/{userId}/books/{bookId}/`.

Each book is handled best-effort: one failure is logged and counted, not fatal
to the rest. The collection-group query needs the `COLLECTION_GROUP` index on
`(status, updatedAt)` in `firestore.indexes.json`.

## What runs the reconcile

- **`reconcileStaleProcessingBooks`** — a scheduled Cloud Function
  (`onSchedule`, every 15 minutes) that runs the reconcile with a 60-minute
  staleness floor. This is the guaranteed net for stubs the client-side rollback
  could not remove.
- **`reconcileStaleProcessingBooksHttp`** — the same logic behind an IAM-private
  HTTP Cloud Function, for manual/ad-hoc runs. Query params:
  - `?olderThanMinutes=` — staleness threshold (default `60`).
  - `?dryRun=` — `false` to actually reconcile; anything else (**default**) only
    reports the matches.
- **`.github/workflows/reconcile-stale-processing-books.yml`** — a
  `workflow_dispatch` job that picks the environment (`staging` /
  `production`), authenticates via Workload Identity Federation as the
  `firebase-deploy` service account, resolves the deployed HTTP function URL,
  mints a Google-signed ID token for it, and `POST`s. Defaults to a dry run.

## How to run it manually

The scheduled function runs on its own; you only need the manual path to force a
run or to preview matches.

1. Deploy first if the function isn't live yet: run the **Deploy** workflow for
   the target environment (it ships `functions` and `firestore:indexes`).
2. Run the **Reconcile stale processing books** workflow:
   - `environment`: `staging` or `production`.
   - `olderThanMinutes`: leave at `60` unless you have a reason to change it.
   - `dryRun`: keep `true` first — the run logs exactly which books would be
     reprocessed or deleted. Re-run with `dryRun` unchecked to act on them.
