# Seeding the dev emulators

`bun run dev` runs `web/scripts/seed.ts` once the emulators are ready. It
creates the test user (`test@example.com` / `password123`), the
authors/series/tags, and the sample books from `fixtures/books/`.

## Why books skip metadata extraction

Seeding used to follow the app's upload flow: upload the epub, wait for the
`extractBookMetadata` function to process it, then overwrite the result with
the seed's own metadata. The extraction wait dominated seed time and hung the
whole `bun run dev` whenever the trigger was slow or lost — all for output the
seed threw away anyway.

So the seed precomputes everything instead:

- `createSeededBook` (admin repositories) writes the finished doc — `"ready"`
  status, ready file entry, incremented entity counts — _before_ uploading the
  epub. The upload still fires the trigger, but the function's ready-book
  guard returns without parsing. Metadata in the `books` array of
  `web/scripts/seed.ts` is authoritative and need not match the epub.
- Covers are not resized at seed time either: each fixture carries a committed
  `cover.png`, pre-normalised offline by `web/scripts/prepareCoverFixture.ts`
  to what extraction would produce, and uploaded as-is.

## Adding a seeded book

1. Create a directory under `fixtures/books/` with `book.epub` and
   `cover.jpg`.
2. Generate the normalised `cover.png` from it:

   ```sh
   cd web && bun scripts/prepareCoverFixture.ts <fixture-name>
   ```

   Rerun this whenever `cover.jpg` changes.

3. Add an entry to the `books` array in `web/scripts/seed.ts`.
