# Project Overview

Calibre-Web Serverless is a modern reimplementation of [calibre-web](https://github.com/janeczku/calibre-web) using a serverless architecture. The goal is to improve maintainability and reduce operational costs compared to the original Python/Flask implementation.

# Development Environment

Nix flake provides the development environment with bun and firebase-tools. Pre-commit hooks (biome, treefmt) run automatically.

# Commands

```bash
# Development (starts Next.js + Firebase emulators with seed data)
bun run dev

# Build
bun run build

# Run tests
bun run test

# Run a single test file
bun vitest path/to/test.ts

# Run E2E tests
bun run test:e2e
```

# Architecture

## Tech Stack

- **Framework**: Next.js 16 with App Router and React 19
- **UI**: Chakra UI v3 with next-themes for color mode
- **Forms**: react-hook-form
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Testing**: Vitest with jsdom and React Testing Library, Playwright for E2E

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/
│   ├── ui/           # Chakra UI wrapper components
│   └── AuthGuard.tsx # Route protection component
├── contexts/
│   └── AuthContext.tsx # Firebase auth state management
└── lib/
    └── firebase.ts   # Firebase initialization
e2e/                  # Playwright E2E tests
```

## Authentication

- `AuthContext` wraps the app and provides `user`, `loading`, and `signOut` via React context
- `AuthGuard` component protects routes - renders children only when authenticated, redirects to `/` otherwise
- Uses render props pattern: `<AuthGuard>{({ user, signOut }) => ...}</AuthGuard>`
- Login page (`/`) redirects to `/dashboard` when already authenticated

## Firebase Emulators

- Development uses Firebase emulators (Auth on :9099, Firestore on :8080, Storage on :9199)
- Seed data in `seed/` directory includes a test user: `test@example.com` / `password123`
- `bun run dev` automatically starts emulators with `--import=seed`

## Path Aliases

- `@/*` maps to `./src/*`

# Chakra UI

- Use the Chakra UI MCP tools when available (`mcp__chakra-ui__*`)
- Before using a component, check if a snippet exists in `src/components/ui/` - these are pre-configured wrappers that should be used instead of importing directly from `@chakra-ui/react`

```bash
# List available snippets
bun x @chakra-ui/cli snippet list

# Add a snippet (generates to src/components/ui/)
bun x @chakra-ui/cli snippet add <snippet-name>
```

# E2E Testing Guidelines

- Before reporting E2E test implementation as complete, always open the Playwright report in a browser (`bun x playwright show-report`)
