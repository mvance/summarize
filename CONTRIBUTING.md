# Contributing to Summarize

Thank you for your interest in contributing to Summarize! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Commit Conventions](#commit-conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior by opening an issue.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 24
- [pnpm](https://pnpm.io/) (package manager)
- [Git](https://git-scm.com/)

### Setup

1. Fork the repository on GitHub.

2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-username>/summarize.git
   cd summarize
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Build the project (builds core first, then CLI):

   ```bash
   pnpm build
   ```

5. Verify everything works:

   ```bash
   pnpm check
   ```

   This runs formatting checks, linting, type checking, and tests with coverage.

## Project Structure

Summarize is a monorepo managed with pnpm workspaces:

```
summarize/
  packages/core/        # @steipete/summarize-core — library surface for programmatic use
  apps/chrome-extension/ # Chrome Side Panel + Firefox Sidebar extension
  src/                   # CLI entry point and main package source
  scripts/               # Build and release scripts
  tests/                 # Test files
  docs/                  # Documentation assets
```

Key packages:

- **`@steipete/summarize`** — CLI with TTY progress, streaming output, and daemon support.
- **`@steipete/summarize-core`** (`packages/core`) — Standalone library for programmatic use. No CLI entrypoints.

When importing from apps, prefer `@steipete/summarize-core` to avoid pulling CLI-only dependencies.

## Development Workflow

### Building

```bash
pnpm build          # Full build (core first, then lib + CLI)
pnpm -C packages/core build   # Build core only
```

### Linting and Formatting

```bash
pnpm lint           # Run oxlint with type-aware checks
pnpm lint:fix       # Auto-fix lint issues + format
pnpm format         # Format with oxfmt
pnpm format:check   # Check formatting without writing
```

### Type Checking

```bash
pnpm typecheck      # Type check core + main package
```

### Testing

```bash
pnpm test           # Run tests with vitest
pnpm test:coverage  # Run tests with coverage report
```

### Full Check (CI Gate)

Before submitting a PR, run the full check:

```bash
pnpm check
```

This is equivalent to: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage`

### Chrome Extension Development

```bash
pnpm -C apps/chrome-extension build      # Build the extension
pnpm -C apps/chrome-extension test:chrome # Run extension E2E tests
```

### Daemon

```bash
pnpm summarize daemon restart   # Restart the local daemon
pnpm summarize daemon status    # Check daemon status
```

To rebuild both the extension and daemon:

```bash
pnpm -C apps/chrome-extension build
pnpm summarize daemon restart
```

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). All commit messages must follow this format:

```
<type>: <description>
```

Common types:

| Type       | Description                                      |
| ---------- | ------------------------------------------------ |
| `feat:`    | A new feature                                    |
| `fix:`     | A bug fix                                        |
| `docs:`    | Documentation changes                            |
| `test:`    | Adding or updating tests                         |
| `refactor:`| Code change that neither fixes a bug nor adds a feature |
| `chore:`   | Maintenance tasks (deps, config, CI)             |
| `perf:`    | Performance improvements                         |

Examples:

```
feat: add PDF page range support
fix: handle empty transcript gracefully
docs: clarify CLI flag descriptions
test: cover local ElevenLabs diarization
```

Use `!` suffix for breaking changes (e.g., `feat!: change default output format`).

## Submitting a Pull Request

1. Create a branch from `main`:

   ```bash
   git checkout -b feat/your-feature main
   ```

2. Make your changes. Keep PRs focused on a single feature or fix.

3. Run the full check:

   ```bash
   pnpm check
   ```

4. Commit with a conventional commit message:

   ```bash
   git commit -m "feat: describe your change"
   ```

5. Push to your fork:

   ```bash
   git push origin feat/your-feature
   ```

6. Open a Pull Request against the `main` branch on GitHub.

### PR Guidelines

- Keep PRs small and focused. One feature or fix per PR.
- Write a clear PR description explaining what changed and why.
- Reference any related issues (e.g., "Closes #123").
- Ensure `pnpm check` passes before requesting review.
- If your change affects the CLI, update relevant documentation in `docs/` or `README.md`.

## Reporting Issues

Before opening an issue, check if a similar issue already exists.

When reporting a bug, include:

- Summarize version (`summarize --version`)
- Node.js version (`node --version`)
- Operating system and version
- Steps to reproduce the issue
- Expected vs actual behavior
- Relevant error messages or logs

## Questions?

If you have questions about contributing, feel free to open a [discussion](https://github.com/steipete/summarize/discussions) or check the [README](./README.md) for more information about the project.
