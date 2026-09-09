# Calibre-Web Serverless

> [!WARNING]
> This project is under active development and many features are not yet implemented.

A modern, serverless reimplementation of [Calibre-Web](https://github.com/janeczku/calibre-web) built with Next.js and TypeScript.

## Why This Project?

The original Calibre-Web requires a persistent server instance, incurring continuous hosting costs. However, most users access their library through dedicated e-reader devices, meaning they only need the server for brief moments—uploading books, editing metadata, and downloading files.

This project adopts a serverless architecture to:

- **Reduce costs** — Pay only for actual usage, not idle time
- **Ensure reliability** — Leverage managed services (Firebase) for affordable, redundant storage
- **Improve maintainability** — Use static typing with TypeScript for safer code, and leverage a modern tech stack to minimize codebase size
- **Provide a refined UI** — Deliver a modern, polished user experience

## Goals

Achieve feature parity with Calibre-Web while embracing serverless principles and modern web technologies.

## Tech Stack

- **Framework**: Next.js (App Router), React
- **UI**: Chakra UI, Emotion
- **Forms**: react-hook-form
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Language**: TypeScript
- **Testing**: Vitest, Playwright, Storybook
- **Linting/Formatting**: Biome

## Development

`bun run dev` starts Next.js together with the Firebase emulators and seed data.

### Stabilizing the metadata search locally

The "fetch metadata from the internet" feature calls the Google Books API. Without an API key it falls back to the public, IP-rate-limited quota and quickly returns `429`, which makes local verification flaky. For stable local testing, set a Google Books API key in `.envrc.local` (gitignored):

```bash
# .envrc.local
export GOOGLE_BOOKS_API_KEY=your-google-books-api-key
```

`.envrc` sources `.envrc.local` automatically — run `direnv allow` after creating it. The key is only needed locally; deployed environments read it from Secret Manager.

## Roadmap

Shipped:

- [x] Authentication, with password reset
- [x] Library dashboard
- [x] Book upload — several files at once, in a background queue that survives in-app navigation and resumes uploads interrupted mid-transfer
- [x] Multiple file formats per book (EPUB, PDF, MOBI, AZW, AZW3, FB2, TXT)
- [x] Auto-extract metadata from uploaded books (EPUB, PDF)
- [x] Book metadata editor
- [x] Book cover management, including custom cover upload
- [x] Book deletion
- [x] Filter and sort the library by author, series, publisher, tag, language and rating
- [x] Bookshelves (user-created collections)
- [x] Fetch metadata from external sources by title or identifier
- [x] OPDS catalog, authenticated, with per-bookshelf feeds
- [x] Built-in reader for PDF and EPUB, including vertical writing

Planned:

- [ ] Book detail page
- [ ] Book search
- [ ] Reading progress tracking
- [ ] Send-to-Kindle
- [ ] NotebookLM integration
- [ ] ML-based metadata extraction from cover images (fallback)
- [ ] Social login
- [ ] Two-factor authentication
- [ ] Passkey support
