# Book fixtures

Public-domain books used as test fixtures for the metadata extractors and the
`extractBookMetadata` usecase, and as the data the dev seed loads into the
emulators. Each book lives in its own directory as:

- `book.epub` — the book file (+ `book.<format>` for additional formats)
- `cover.jpg` — the original cover, served to Storybook stories
- `cover.png` — the cover pre-normalised to what `extractBookMetadata` would
  produce; the dev seed uploads it as-is

See `docs/seeding.md` for how seeding works and how to add a seeded book.

## alice-in-wonderland

- `book.epub` — Project Gutenberg eBook #11 (_Alice's Adventures in Wonderland_,
  Lewis Carroll). The OPF `<metadata>` was augmented with `dc:description`,
  `dc:publisher` and a typed `dc:identifier opf:scheme="ISBN"` (the placeholder
  example ISBN `9783161484100`) so a single real fixture exercises every field
  the EPUB extractor reads.
- `book.txt` — the Project Gutenberg plain-text edition
  (https://www.gutenberg.org/ebooks/11.txt.utf-8). Seeded together with
  `book.pdf` as additional formats so the dev data exercises the
  multi-format UI.
- `book.pdf` — generated from `book.epub` with Calibre:
  `ebook-convert book.epub book.pdf`. It carries a plain Info dict plus an XMP
  packet, so the PDF extractor reads title/author/description/publisher/language
  from a realistic container. PDF-specific parsing branches (hex/UTF-16 strings,
  date formats, compressed streams, XMP merge priority, malformed input) are
  synthesized in `pdf.test.ts` by swapping this base file's metadata.

## rashomon

- `book.epub` — real Japanese EPUB (_羅生門_, 芥川龍之介), for multibyte
  title/author handling and the no-embedded-cover path.
