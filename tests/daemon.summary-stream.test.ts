import { describe, expect, it } from "vitest";
import { createDaemonSummaryStreamHandler } from "../src/daemon/flow-context.js";
import { mergeStreamingChunk } from "../src/engine/streaming.js";

describe("daemon summary stream", () => {
  it("sends full snapshots for corrected cumulative chunks", async () => {
    const chunks: string[] = [];
    const stream = createDaemonSummaryStreamHandler({
      writeChunk: (text) => chunks.push(text),
    });

    expect(
      await stream.onChunk({
        streamed: "\n\nHello worlt",
        prevStreamed: "",
        appended: "\n\nHello worlt",
      }),
    ).toBe(true);
    expect(
      await stream.onChunk({
        streamed: "\n\nHello world",
        prevStreamed: "\n\nHello worlt",
        appended: "d",
      }),
    ).toBe(true);
    expect(
      await stream.onChunk({
        streamed: "\n\nHello world!",
        prevStreamed: "\n\nHello world",
        appended: "!",
      }),
    ).toBe(true);

    let clientText = "";
    for (const chunk of chunks) {
      clientText = mergeStreamingChunk(clientText, chunk).next;
    }
    expect(chunks).toEqual(["Hello worlt", "Hello world", "!"]);
    expect(clientText).toBe("Hello world!");
  });

  it("strips leading blank lines from the first emitted chunk", async () => {
    const chunks: string[] = [];
    const stream = createDaemonSummaryStreamHandler({
      writeChunk: (text) => chunks.push(text),
    });

    expect(
      await stream.onChunk({
        streamed: "\n\nSummary",
        prevStreamed: "",
        appended: "\n\nSummary",
      }),
    ).toBe(true);
    expect(chunks).toEqual(["Summary"]);
  });
});
