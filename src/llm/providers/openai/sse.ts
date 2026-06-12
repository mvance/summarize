import type { LlmTokenUsage } from "../../types.js";

export async function* parseOpenAiSseJsonStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentData = "";

  const flush = (): Record<string, unknown> | null => {
    const data = currentData.trim();
    currentData = "";
    if (!data || data === "[DONE]") return null;
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  };

  const processLine = (line: string): Record<string, unknown> | null => {
    if (line === "") return flush();
    if (line.startsWith(":")) return null;
    if (line.startsWith("data:")) {
      currentData += `${line.slice("data:".length).trimStart()}\n`;
    }
    return null;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const idx = buffer.indexOf("\n");
      if (idx === -1) break;
      const rawLine = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const event = processLine(rawLine.replace(/\r$/, ""));
      if (event) yield event;
    }
  }

  buffer += decoder.decode();
  if (buffer) {
    const event = processLine(buffer.replace(/\r$/, ""));
    if (event) yield event;
  }
  const event = flush();
  if (event) yield event;
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
