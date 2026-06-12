import type { Message } from "@earendil-works/pi-ai";
import type { RunStart, UiState } from "../../lib/panel-contracts";
import type { SseSlidesData } from "../../lib/runtime-contracts";
export type { RunStart, UiState } from "../../lib/panel-contracts";

export type PanelPhase = "idle" | "setup" | "connecting" | "streaming" | "error";

export type ChatMessage = Message & { id: string };

export type PendingSummaryResult =
  | { type: "run"; run: RunStart }
  | { type: "snapshot"; run: RunStart; markdown: string };

export type PendingSlidesRun = {
  runId: string;
  url: string | null;
  local?: boolean;
};

export type PanelState = {
  ui: UiState | null;
  navigation: {
    activeTabId: number | null;
    activeTabUrl: string | null;
  };
  activeRun: {
    tabId: number | null;
  };
  pendingRuns: {
    summaryByUrl: Record<string, PendingSummaryResult>;
    slidesByUrl: Record<string, PendingSlidesRun>;
  };
  runId: string | null;
  slidesRunId: string | null;
  currentSource: { url: string; title: string | null } | null;
  lastMeta: { inputSummary: string | null; model: string | null; modelLabel: string | null };
  summaryMarkdown: string | null;
  summaryFromCache: boolean | null;
  retainedSlideSummary: {
    markdown: string;
    url: string | null;
  } | null;
  slides: SseSlidesData | null;
  phase: PanelPhase;
  error: string | null;
  chatStreaming: boolean;
};
