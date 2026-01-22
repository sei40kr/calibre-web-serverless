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

## Project Structure

```
src/
├── app/                # Next.js App Router pages (routing only)
├── components/
│   ├── pages/          # Pure page components
│   ├── ui/             # Chakra UI wrapper components
│   └── AuthGuard.tsx   # Route protection component
├── contexts/
│   └── AuthContext.tsx # Firebase auth state management
├── hooks/              # Data subscription hooks
├── lib/
│   └── firebase.ts     # Firebase initialization
├── models/             # Domain models
└── services/           # Infrastructure services (Firebase, etc.)
e2e/                    # Playwright E2E tests
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

# Coding Conventions

## Path Aliases

- `@/*` maps to `./src/*`

## Services and Infrastructure

- External infrastructure (Firebase, etc.) must be encapsulated as services in `src/services/`
- Services handle all communication with external systems

## Domain Models

- Domain models are placed under `src/models/`
- Express domain constraints through types as much as possible (branded types, union types, etc.)

## Page Components

- Extract pure page components and place them under `src/components/pages/`
- Route files in `src/app/` should only handle routing concerns and delegate to page components

## Component Purity

- Components under `src/components/` should be pure (no direct infrastructure dependencies)
- Use props and callbacks for data and side effects

## Data Subscription Hooks

- Create hooks under `src/hooks/` for subscribing to data store
- Components must access data through hooks, never directly from services

## DTOs and Persistence

- Domain models may be converted to DTOs for persistence
- Firestore DTOs use the suffix `Document` (e.g., `BookDocument`)
- DTO definitions and conversion logic must stay within services
- Never leak infrastructure knowledge (Firestore types, etc.) outside of services

# Chakra UI

- Use the Chakra UI MCP tools when available (`mcp__chakra-ui__*`)
- Always prefer Chakra UI components over custom implementations
- **Always prioritize snippets**: Before using a Chakra UI component, check if a snippet exists in `src/components/ui/` - these are pre-configured wrappers that should be used instead of importing directly from `@chakra-ui/react`

```bash
# List available snippets
bun x @chakra-ui/cli snippet list

# Add a snippet (generates to src/components/ui/)
bun x @chakra-ui/cli snippet add <snippet-name>
```

**Note**: The snippet CLI commands do not work in sandbox mode. Run them with sandbox disabled.

# Storybook / Interaction Tests

- Stories: `src/components/Foo.stories.tsx`
- Interaction tests use `storybook/test` (`expect`, `userEvent`, `within`, `fn`)
- Visual verification is manual; run `bun vitest --silent passed-only --reporter tap <file...>` to verify interaction tests pass

# E2E Testing (Playwright)

- Run `bun playwright test --reporter=json <test-filter...>` to verify E2E tests pass (JSON format is easier for AI to parse)
