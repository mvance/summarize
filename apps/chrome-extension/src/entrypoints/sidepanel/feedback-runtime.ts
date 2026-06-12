import { createErrorController } from "./error-controller";
import { createHeaderController } from "./header-controller";
import type { PanelStateAction } from "./panel-state-store";
import type { PanelPhase, PanelState } from "./types";

type FeedbackEventTarget = {
  addEventListener: (type: string, listener: EventListener) => void;
};

const OPTIONS_TAB_STORAGE_KEY = "summarize:options-tab";

export function createSidepanelFeedbackRuntime({
  panelState,
  dispatchPanelState,
  headerEl,
  titleEl,
  subtitleEl,
  progressFillEl,
  panelErrorEl,
  panelErrorMessageEl,
  panelErrorRetryBtn,
  panelErrorLogsBtn,
  inlineErrorEl,
  inlineErrorMessageEl,
  inlineErrorRetryBtn,
  inlineErrorLogsBtn,
  inlineErrorCloseBtn,
  slideNoticeEl,
  slideNoticeMessageEl,
  slideNoticeRetryBtn,
  retryLastAction,
  retrySlidesStream,
  sendOpenOptions,
  setSlidesBusy,
  rebuildSlideDescriptions,
  queueSlidesRender,
  eventTarget = window,
  storage = localStorage,
}: {
  panelState: PanelState;
  dispatchPanelState: (action: PanelStateAction) => void;
  headerEl: HTMLElement;
  titleEl: HTMLElement;
  subtitleEl: HTMLElement;
  progressFillEl: HTMLElement;
  panelErrorEl: HTMLElement;
  panelErrorMessageEl: HTMLElement;
  panelErrorRetryBtn: HTMLButtonElement;
  panelErrorLogsBtn: HTMLButtonElement;
  inlineErrorEl: HTMLElement;
  inlineErrorMessageEl: HTMLElement;
  inlineErrorRetryBtn: HTMLButtonElement;
  inlineErrorLogsBtn: HTMLButtonElement;
  inlineErrorCloseBtn: HTMLButtonElement;
  slideNoticeEl: HTMLElement;
  slideNoticeMessageEl: HTMLElement;
  slideNoticeRetryBtn: HTMLButtonElement;
  retryLastAction: () => void;
  retrySlidesStream: () => void;
  sendOpenOptions: () => void;
  setSlidesBusy: (value: boolean) => void;
  rebuildSlideDescriptions: () => void;
  queueSlidesRender: () => void;
  eventTarget?: FeedbackEventTarget;
  storage?: Pick<Storage, "setItem">;
}) {
  const headerController = createHeaderController({
    headerEl,
    titleEl,
    subtitleEl,
    progressFillEl,
    getState: () => ({
      phase: panelState.phase,
      summaryFromCache: panelState.summaryFromCache,
    }),
  });

  const openOptionsTab = (tabId: string) => {
    try {
      storage.setItem(OPTIONS_TAB_STORAGE_KEY, tabId);
    } catch {
      // Continue opening options when local storage is unavailable.
    }
    sendOpenOptions();
  };

  const errorController = createErrorController({
    panelEl: panelErrorEl,
    panelMessageEl: panelErrorMessageEl,
    panelRetryBtn: panelErrorRetryBtn,
    panelLogsBtn: panelErrorLogsBtn,
    inlineEl: inlineErrorEl,
    inlineMessageEl: inlineErrorMessageEl,
    inlineRetryBtn: inlineErrorRetryBtn,
    inlineLogsBtn: inlineErrorLogsBtn,
    inlineCloseBtn: inlineErrorCloseBtn,
    onRetry: retryLastAction,
    onOpenLogs: () => openOptionsTab("logs"),
    onPanelVisibilityChange: headerController.updateHeaderOffset,
  });

  const hideSlideNotice = () => {
    slideNoticeEl.classList.add("hidden");
    slideNoticeMessageEl.textContent = "";
    slideNoticeRetryBtn.hidden = true;
    headerController.updateHeaderOffset();
  };

  const showSlideNotice = (message: string, options?: { allowRetry?: boolean }) => {
    slideNoticeMessageEl.textContent = message;
    slideNoticeRetryBtn.hidden = !options?.allowRetry;
    slideNoticeEl.classList.remove("hidden");
    headerController.updateHeaderOffset();
  };

  const setPhase = (phase: PanelPhase, options?: { error?: string | null }) => {
    dispatchPanelState({ type: "phase", phase, error: options?.error });
    const running = phase === "connecting" || phase === "streaming";
    if (phase === "error") {
      const message =
        panelState.error && panelState.error.trim().length > 0
          ? panelState.error
          : "Something went wrong.";
      errorController.showPanelError(message);
      setSlidesBusy(false);
    } else {
      errorController.clearPanelError();
      if (!running) setSlidesBusy(false);
    }
    if (running) {
      headerController.armProgress();
    } else {
      headerController.stopProgress();
      if (panelState.slides) {
        rebuildSlideDescriptions();
        queueSlidesRender();
      }
    }
  };

  const handleGlobalError = (event: ErrorEvent) => {
    const message =
      event.error instanceof Error ? event.error.stack || event.error.message : event.message;
    headerController.setStatus(`Error: ${message}`);
    setPhase("error", { error: message });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const { reason } = event;
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    headerController.setStatus(`Error: ${message}`);
    setPhase("error", { error: message });
  };

  headerController.updateHeaderOffset();
  eventTarget.addEventListener("resize", headerController.updateHeaderOffset as EventListener);
  eventTarget.addEventListener("error", handleGlobalError as EventListener);
  eventTarget.addEventListener("unhandledrejection", handleUnhandledRejection as EventListener);
  slideNoticeRetryBtn.addEventListener("click", retrySlidesStream);

  return {
    errorController,
    headerController,
    hideSlideNotice,
    setPhase,
    showSlideNotice,
  };
}
