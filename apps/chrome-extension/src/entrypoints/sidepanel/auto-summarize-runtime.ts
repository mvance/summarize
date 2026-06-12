import type { PanelPhase } from "./types";

export function createAutoSummarizeRuntime({
  getEnabled,
  getPhase,
  hasSummary,
  summarize,
  delayMs = 350,
}: {
  getEnabled: () => boolean;
  getPhase: () => PanelPhase;
  hasSummary: () => boolean;
  summarize: () => void;
  delayMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    if (!getEnabled()) return;
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (!getEnabled() || getPhase() !== "idle" || hasSummary()) return;
      summarize();
    }, delayMs);
  };

  return { cancel, schedule };
}
