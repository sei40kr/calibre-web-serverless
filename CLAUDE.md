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
- **Testing**: Vitest, Storybook (interaction tests), Playwright (E2E)

## Monorepo Structure

Bun workspaces with three packages at the repo root:

```
domain/                       # @calibre-web-serverless/domain
└── models/                   # Domain models (book, author, series, tag, publisher, bookshelf, language, identifier)

infrastructure/               # @calibre-web-serverless/infrastructure
├── lib/
│   ├── firebase.ts           # Firebase initialization + emulator setup
│   └── auth.ts               # Re-exports firebase/auth + auth instance
└── services/                 # Infrastructure services (Firebase Firestore/Storage)

web/                          # @calibre-web-serverless/web
├── src/
│   ├── app/                  # Next.js App Router pages (routing only)
│   ├── components/
│   │   ├── pages/            # Pure page components
│   │   ├── ui/               # Chakra UI wrapper components
│   │   └── AuthGuard.tsx     # Route protection component
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Firebase auth state management
│   │   └── BookUploadContext.tsx  # App-wide background upload queue
│   └── hooks/                # Data subscription hooks
├── scripts/                  # Seed scripts
├── e2e/                      # Playwright E2E tests
└── .storybook/               # Storybook config
```

### Cross-package imports

- **Within a package**: Use relative imports (`./identifier`)
- **Between packages**: Use package exports (`@calibre-web-serverless/domain/models/book`)
- **Firebase auth types**: Import from `@calibre-web-serverless/infrastructure/lib/auth` (re-exports `User`, `signInWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, `FirebaseError`)

## Authentication

- `AuthContext` wraps the app and provides `user`, `loading`, and `signOut` via React context
- `AuthGuard` component protects routes - renders children only when authenticated, redirects to `/` otherwise
- Uses render props pattern: `<AuthGuard>{({ user, signOut }) => ...}</AuthGuard>`
- Login page (`/`) redirects to `/dashboard` when already authenticated

## Firebase Emulators

- Development uses Firebase emulators (Auth on :9099, Firestore on :8080, Storage on :9199)
- Seed data in `seed/` directory includes a test user: `test@example.com` / `password123`
- `bun run dev` automatically starts emulators with `--import=seed`

# Coding Conventions

## Path Aliases

- `@/*` maps to `./src/*` (web package only)

## Services and Infrastructure

- External infrastructure (Firebase, etc.) must be encapsulated as services in `infrastructure/services/`
- Services handle all communication with external systems

## Domain Models

- Domain models are placed under `domain/models/`
- Express domain constraints through types as much as possible (branded types, union types, etc.)

## Page Components

- Extract pure page components and place them under `web/src/components/pages/`
- Route files in `web/src/app/` should only handle routing concerns and delegate to page components

## Component Purity

- Components under `web/src/components/` should be pure (no direct infrastructure dependencies)
- Use props and callbacks for data and side effects

## Data Hooks

- Hooks in `web/src/hooks/` bridge components and services for data reading/subscription
- Components read data through hooks, never directly from services
- Mutations (one-off writes) can call services directly without a hook
- Error translation (e.g., FirebaseError → domain errors) belongs in hooks

## Model ↔ Document Conversion

- Never expose infrastructure types (`Timestamp`, `FieldValue`, `DocumentReference`, etc.) outside of services
- Conversion logic (`toModel` / `toDocument`) must stay within services
- Define a `Document` interface for complex entities with type differences (e.g., `BookDocument` uses `Timestamp`, singleton string codes)
- For complex entities, create `toModel` / `toDocument` functions (e.g., `toBook` / `toBookDocument`) in the service; simple cases can inline
- Create payload type: `Omit<Document, "id" | "createdAt" | "updatedAt"> & { createdAt: FieldValue; updatedAt: FieldValue }`

# Chakra UI

- Use the Chakra UI MCP tools when available (`mcp__chakra-ui__*`)
- Always prefer Chakra UI components over custom implementations
- **Always prioritize snippets**: Before using a Chakra UI component, check if a snippet exists in `web/src/components/ui/` - these are pre-configured wrappers that should be used instead of importing directly from `@chakra-ui/react`

```bash
# List available snippets
bun x @chakra-ui/cli snippet list

# Add a snippet (generates to web/src/components/ui/)
bun x @chakra-ui/cli snippet add <snippet-name>
```

**Note**: The snippet CLI commands do not work in sandbox mode. Run them with sandbox disabled.

# Storybook / Interaction Tests

- Stories: `web/src/components/Foo.stories.tsx`
- Interaction tests use `storybook/test` (`expect`, `userEvent`, `within`, `fn`)
- Visual verification is manual; run `bun vitest --silent passed-only --reporter tap <file...>` to verify interaction tests pass

# E2E Testing (Playwright)

- Run `bun playwright test --reporter=json <test-filter...>` to verify E2E tests pass (JSON format is easier for AI to parse)
