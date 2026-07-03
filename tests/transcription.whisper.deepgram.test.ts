import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseDeepgramResponse,
  transcribeFileWithDeepgram,
  transcribeWithDeepgram,
} from "../packages/core/src/transcription/whisper/deepgram.js";

const successPayload = {
  results: {
    channels: [{ alternatives: [{ transcript: "Hello from Deepgram." }] }],
    utterances: [
      { start: 0.12, end: 1.5, transcript: "Hello from Deepgram." },
      { start: 2, end: 2.75, transcript: "Second sentence." },
    ],
  },
};

describe("transcription/whisper deepgram", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts media with the Nova default and preserves utterance timestamps", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString());
      expect(url.origin + url.pathname).toBe("https://deepgram.example/v1/listen");
      expect(url.searchParams.get("model")).toBe("nova-3");
      expect(url.searchParams.get("smart_format")).toBe("true");
      expect(url.searchParams.get("detect_language")).toBe("true");
      expect(url.searchParams.get("utterances")).toBe("true");
      expect(new Headers(init?.headers).get("authorization")).toBe("Token DG");
      expect(new Headers(init?.headers).get("content-type")).toBe("audio/mpeg");
      expect(init?.body).toBeInstanceOf(Blob);
      return Response.json(successPayload);
    });

    const result = await transcribeWithDeepgram(new Uint8Array([1, 2, 3]), "audio/mpeg", "DG", {
      fetchImpl: fetchMock,
      baseUrl: "https://deepgram.example/v1",
    });

    expect(result).toEqual({
      text: "Hello from Deepgram.",
      segments: [
        { startMs: 120, endMs: 1500, text: "Hello from Deepgram." },
        { startMs: 2000, endMs: 2750, text: "Second sentence." },
      ],
    });
  });

  it("uses the model override and the direct file upload path", async () => {
    const root = await mkdtemp(join(tmpdir(), "summarize-deepgram-"));
    const filePath = join(root, "clip.mp3");
    await writeFile(filePath, new Uint8Array([1, 2, 3]));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(input.toString()).searchParams.get("model")).toBe("whisper-large");
      expect(init?.body).toBeInstanceOf(Blob);
      return Response.json(successPayload);
    });

    try {
      const result = await transcribeFileWithDeepgram({
        filePath,
        mediaType: "audio/mpeg",
        apiKey: "DG",
        fetchImpl: fetchMock,
        baseUrl: "https://deepgram.example/v1",
        env: { SUMMARIZE_DEEPGRAM_TRANSCRIPTION_MODEL: "whisper-large" },
      });
      expect(result.text).toBe("Hello from Deepgram.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("routes Deepgram as an automatic remote fallback", async () => {
    const fetchMock = vi.fn(async () => Response.json(successPayload));
    vi.stubEnv("SUMMARIZE_DISABLE_LOCAL_WHISPER_CPP", "1");
    vi.stubGlobal("fetch", fetchMock);
    const { transcribeMediaWithWhisper } =
      await import("../packages/core/src/transcription/whisper.js");

    const result = await transcribeMediaWithWhisper({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: "audio/mpeg",
      filename: "audio.mp3",
      groqApiKey: null,
      openaiApiKey: null,
      falApiKey: null,
      deepgramApiKey: "DG",
    });

    expect(result.text).toBe("Hello from Deepgram.");
    expect(result.provider).toBe("deepgram");
    expect(result.segments).toHaveLength(2);
  });

  it("reports bounded HTTP errors and tolerates malformed payloads", async () => {
    const fetchMock = vi.fn(async () => new Response("x".repeat(400), { status: 401 }));
    await expect(
      transcribeWithDeepgram(new Uint8Array([1]), "audio/wav", "bad", {
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/^Deepgram transcription failed \(401\): x{200}…$/);

    expect(parseDeepgramResponse({ results: { channels: [] } })).toEqual({
      text: null,
      segments: null,
    });
  });

  it("handles blank media metadata, malformed utterances, and unreadable error bodies", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(input.toString()).searchParams.get("model")).toBe("tiny");
      expect(new Headers(init?.headers).get("content-type")).toBe("application/octet-stream");
      return Response.json({
        results: {
          channels: [{ alternatives: [{ transcript: "  Parsed transcript  " }] }],
          utterances: [
            null,
            { start: -1, end: 1, transcript: "invalid start" },
            { start: 1, end: "unknown", transcript: "  valid   segment  " },
          ],
        },
      });
    });

    await expect(
      transcribeWithDeepgram(new Uint8Array([1]), "   ", "DG", {
        fetchImpl: fetchMock,
        model: " tiny ",
      }),
    ).resolves.toEqual({
      text: "Parsed transcript",
      segments: [{ startMs: 1000, endMs: null, text: "valid segment" }],
    });

    expect(parseDeepgramResponse(null)).toEqual({ text: null, segments: null });
    expect(parseDeepgramResponse({})).toEqual({ text: null, segments: null });

    const unreadableError = {
      ok: false,
      status: 503,
      text: async () => {
        throw new Error("body unavailable");
      },
    } as Response;
    await expect(
      transcribeWithDeepgram(new Uint8Array([1]), "audio/wav", "DG", {
        fetchImpl: vi.fn(async () => unreadableError),
      }),
    ).rejects.toThrow("Deepgram transcription failed (503)");
  });
});
