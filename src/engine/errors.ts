export type EngineErrorCode = "ASSET_LIKE_HTML_FETCH" | "SUMMARY_STREAM_INTERRUPTED";

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EngineError";
  }
}

export function hasEngineErrorCode(error: unknown, code: EngineErrorCode): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if ((current as Error & { code?: unknown }).code === code) return true;
    current = current.cause;
  }
  return false;
}
