# Book fixtures

Freely redistributable books used as test fixtures for the metadata extractors,
the `extractBookMetadata` usecase and the EPUB reader, and as the data the dev
seed loads into the emulators. The Project Gutenberg titles are distributed
under the [Project Gutenberg License](https://www.gutenberg.org/policy/license.html),
whose full text each EPUB carries and must keep; the Aozora Bunko titles are
public domain. Each book lives in its own directory as:

- `book.epub` — the book file (+ `book.<format>` for additional formats)
- `cover.jpg` — the original cover, served to Storybook stories
- `cover.png` — the cover pre-normalised to what `extractBookMetadata` would
  produce; the dev seed uploads it as-is

See `docs/seeding.md` for how seeding works and how to add a seeded book.

## alice-in-wonderland

- `book.epub` — Project Gutenberg eBook #11 (_Alice's Adventures in Wonderland_,
  Lewis Carroll; public domain, Project Gutenberg License). The OPF
  `<metadata>` was augmented with `dc:description`, `dc:publisher` and a typed
  `dc:identifier opf:scheme="ISBN"` (the placeholder example ISBN
  `9783161484100`) so a single real fixture exercises every field the EPUB
  extractor reads. The license text inside the book is untouched.
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

## the-metamorphosis

- `book.epub` — Project Gutenberg eBook #5200 (_Metamorphosis_, Franz Kafka,
  translated by David Wyllie). Unlike the other titles this one is **not**
  public domain: the translation is © 2002 David Wyllie and is redistributed
  under the Project Gutenberg License included in the file.

## rashomon

- `book.epub` — [Aozora Bunko](https://www.aozora.gr.jp/) EPUB (_羅生門_,
  芥川龍之介; public domain). Vertical-writing Japanese with
  `page-progression-direction="rtl"` and a single-page title page, for
  multibyte title/author handling, the no-embedded-cover path and the
  reader's right-to-left pagination.

## wagahai-wa-neko-de-aru

- `book.epub` — [Aozora Bunko](https://www.aozora.gr.jp/) EPUB
  (_吾輩は猫である_, 夏目漱石; public domain). Horizontal-writing Japanese,
  the left-to-right counterpart to `rashomon` in the reader tests and
  stories.
