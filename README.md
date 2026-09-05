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

- [x] Authentication
- [x] Dashboard
- [ ] Book metadata editor
- [ ] Book detail page
- [ ] Book cover management
- [ ] Auto-extract metadata from uploaded books
- [ ] Book search
- [ ] Browse books by author
- [ ] Browse books by series
- [ ] Browse books by publisher
- [ ] Browse books by tag
- [x] Bookshelves (user-created collections)
- [ ] Fetch metadata from external sources by title or identifier
- [ ] Send-to-Kindle
- [ ] OPDS catalog
- [ ] Built-in reader
- [ ] Reading progress tracking
- [ ] NotebookLM integration
- [ ] ML-based metadata extraction from cover images (fallback)
- [ ] Social login
- [ ] Password reset
- [ ] Two-factor authentication
- [ ] Passkey support
