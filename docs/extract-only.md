# Extract mode

`--extract` prints the extracted content and exits.

Deprecated alias: `--extract-only`.

## Notes

- No summarization LLM call happens in this mode.
- `--format md` (default) may still call the configured LLM for HTML → Markdown conversion (depending on `--markdown-mode`).
- `--length` is intended for summarization guidance; extraction prints full content.
- For non-YouTube URLs with `--format md`, the CLI prefers Firecrawl Markdown by default when `FIRECRAWL_API_KEY` is configured (unless you set `--firecrawl` explicitly).
  - Force plain HTML extraction with `--firecrawl off` (or use `--format text`).
- For non-YouTube URLs with `--format md`, `--markdown-mode auto` can convert HTML → Markdown via an LLM when configured.
  - Force it with `--markdown-mode llm`.
