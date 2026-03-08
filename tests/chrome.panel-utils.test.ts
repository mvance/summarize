import { describe, expect, it } from "vitest";
import {
  buildSlidesText,
  urlsMatch,
} from "../apps/chrome-extension/src/entrypoints/background/panel-utils.js";

describe("chrome panel utils", () => {
  it("matches urls across hash and nested boundaries", () => {
    expect(urlsMatch("https://example.com/watch?v=1#now", "https://example.com/watch?v=1")).toBe(
      true,
    );
    expect(urlsMatch("https://example.com/watch?v=1&list=2", "https://example.com/watch?v=1")).toBe(
      true,
    );
    expect(urlsMatch("https://example.com/a", "https://example.com/b")).toBe(false);
  });

  it("builds slide ocr text with timestamps", () => {
    expect(
      buildSlidesText(
        {
          sourceUrl: "https://example.com/video",
          sourceId: "video",
          sourceKind: "url",
          ocrAvailable: true,
          slides: [
            { index: 1, timestamp: 2, ocrText: "Opening slide" },
            { index: 2, timestamp: 65, ocrText: "Second slide" },
          ],
        },
        true,
      ),
    ).toEqual({
      count: 2,
      text: "Slide 1 @ 0:02:\nOpening slide\n\nSlide 2 @ 1:05:\nSecond slide",
    });
  });

  it("skips slide text when ocr is disabled", () => {
    expect(
      buildSlidesText(
        {
          sourceUrl: "https://example.com/video",
          sourceId: "video",
          sourceKind: "url",
          ocrAvailable: true,
          slides: [{ index: 1, timestamp: 2, ocrText: "Opening slide" }],
        },
        false,
      ),
    ).toBeNull();
  });
});
