import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutoSummarizeRuntime } from "../apps/chrome-extension/src/entrypoints/sidepanel/auto-summarize-runtime.js";
import type { PanelPhase } from "../apps/chrome-extension/src/entrypoints/sidepanel/types.js";

describe("sidepanel auto summarize runtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createHarness() {
    let enabled = true;
    let phase: PanelPhase = "idle";
    let summary = false;
    const summarize = vi.fn();
    const runtime = createAutoSummarizeRuntime({
      getEnabled: () => enabled,
      getPhase: () => phase,
      hasSummary: () => summary,
      summarize,
    });
    return {
      runtime,
      summarize,
      setEnabled: (value: boolean) => {
        enabled = value;
      },
      setPhase: (value: PanelPhase) => {
        phase = value;
      },
      setSummary: (value: boolean) => {
        summary = value;
      },
    };
  }

  it("summarizes after the delay when the panel remains eligible", async () => {
    const harness = createHarness();

    harness.runtime.schedule();
    await vi.advanceTimersByTimeAsync(349);
    expect(harness.summarize).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(harness.summarize).toHaveBeenCalledOnce();
  });

  it("replaces pending work and supports cancellation", async () => {
    const harness = createHarness();

    harness.runtime.schedule();
    await vi.advanceTimersByTimeAsync(200);
    harness.runtime.schedule();
    await vi.advanceTimersByTimeAsync(200);
    expect(harness.summarize).not.toHaveBeenCalled();

    harness.runtime.cancel();
    await vi.runAllTimersAsync();
    expect(harness.summarize).not.toHaveBeenCalled();
  });

  it("checks eligibility both when scheduled and when the timer fires", async () => {
    const disabled = createHarness();
    disabled.setEnabled(false);
    disabled.runtime.schedule();

    const busy = createHarness();
    busy.runtime.schedule();
    busy.setPhase("streaming");

    const summarized = createHarness();
    summarized.runtime.schedule();
    summarized.setSummary(true);

    const disabledLater = createHarness();
    disabledLater.runtime.schedule();
    disabledLater.setEnabled(false);

    await vi.runAllTimersAsync();

    expect(disabled.summarize).not.toHaveBeenCalled();
    expect(busy.summarize).not.toHaveBeenCalled();
    expect(summarized.summarize).not.toHaveBeenCalled();
    expect(disabledLater.summarize).not.toHaveBeenCalled();
  });
});
