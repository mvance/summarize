# Website mode

Use this for non-YouTube URLs.

## What it does

- Fetches the page HTML.
- Extracts “article-ish” content and normalizes it into clean text.
- If extraction looks blocked or too thin, it can retry via Firecrawl (Markdown).
- In `--extract --format md` mode, the CLI prefers Firecrawl Markdown by default when `FIRECRAWL_API_KEY` is configured.
- In `--extract --format md` mode, `--markdown-mode auto|llm` can also convert HTML → Markdown via an LLM using the configured `--model` (no provider fallback).

## Flags

- `--firecrawl off|auto|always`
- `--extract --format md|text` (default: `md`)
- `--markdown-mode off|auto|llm` (default: `auto`; only affects `--extract --format md` for non-YouTube URLs)
- Plain-text mode: use `--extract --format text`.
- `--timeout 30s|30|2m|5000ms` (default: `2m`)
- `--extract` (print extracted content; no summary LLM call)
- `--json` (emit a single JSON object)
- `--verbose` (progress + which extractor was used)
- `--metrics off|on|detailed` (default: `on`; `detailed` prints a breakdown to stderr)

## API keys

- Optional: `FIRECRAWL_API_KEY` (for the Firecrawl fallback / preferred Markdown output)
- Optional: `XAI_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` (also accepts `GOOGLE_GENERATIVE_AI_API_KEY` / `GOOGLE_API_KEY`) (required only when `--markdown-mode llm` is used, or when `--markdown-mode auto` falls back to LLM conversion)
