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
- [ ] Bookshelves (user-created collections)
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
