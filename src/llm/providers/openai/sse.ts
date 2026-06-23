import { parseSseStream } from "@steipete/summarize-core/runtime";
import type { LlmTokenUsage } from "../../types.js";

export async function* parseOpenAiSseJsonStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const message of parseSseStream(body)) {
    if (message.event === "__comment__") continue;
    const data = message.data.trim();
    if (!data) continue;
    if (data === "[DONE]") return;
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === "object") {
      yield parsed as Record<string, unknown>;
    }
  }
}

export function createOpenAiSseError(event: Record<string, unknown>): Error {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const directError = asRecord(event.error);
  const responseError = asRecord(asRecord(event.response)?.error);
  const details = responseError ?? directError ?? event;
  const rawCode = details.code ?? details.type ?? event.code;
  const code = typeof rawCode === "string" ? rawCode : null;
  const message =
    typeof details.message === "string"
      ? details.message
      : typeof event.message === "string"
        ? event.message
        : "OpenAI stream failed.";
  const error = new Error(message);
  if (code) (error as { code?: string }).code = code;
  return error;
}

export function createDeferredUsage(): {
  promise: Promise<LlmTokenUsage | null>;
  resolve: (value: LlmTokenUsage | null) => void;
} {
  let resolve: (value: LlmTokenUsage | null) => void = () => {};
  const promise = new Promise<LlmTokenUsage | null>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
