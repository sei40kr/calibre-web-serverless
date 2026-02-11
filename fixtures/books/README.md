# Book fixtures

Public-domain books used as test fixtures for the metadata extractors and the
`extractBookMetadata` usecase. Each book lives in its own directory as
`book.epub` (+ `cover.jpg`, and `book.pdf` where a PDF fixture is needed).

## alice-in-wonderland

- `book.epub` — Project Gutenberg eBook #11 (_Alice's Adventures in Wonderland_,
  Lewis Carroll). The OPF `<metadata>` was augmented with `dc:description`,
  `dc:publisher` and a typed `dc:identifier opf:scheme="ISBN"` (the placeholder
  example ISBN `9783161484100`) so a single real fixture exercises every field
  the EPUB extractor reads.
- `book.pdf` — generated from `book.epub` with Calibre:
  `ebook-convert book.epub book.pdf`. It carries a plain Info dict plus an XMP
  packet, so the PDF extractor reads title/author/description/publisher/language
  from a realistic container. PDF-specific parsing branches (hex/UTF-16 strings,
  date formats, compressed streams, XMP merge priority, malformed input) are
  synthesized in `pdf.test.ts` by swapping this base file's metadata.

## rashomon

- `book.epub` — real Japanese EPUB (_羅生門_, 芥川龍之介), for multibyte
  title/author handling and the no-embedded-cover path.
