# Lessons Learned: Extension E2E Stabilization Attempts (2026-02-08)

## Goal

Improve stability of Chrome extension E2E tests that exhibit flakiness (race conditions, DOM detachment, async state drift).

Targeted failing tests:
- `sidepanel switches between page, video, and slides modes`
- `sidepanel scrolls YouTube slides and shows text for each slide`

## What We Tried

### 1) Retrying and Longer Timeouts
- Added Playwright retries in CI and increased expect timeouts.
- Result: Helped one test pass on retry in some runs, but did not eliminate failures.

### 2) Polling for aria-label Instead of toHaveAttribute
- Replaced direct `toHaveAttribute` with `expect.poll` on `aria-label`.
- Result: Reduced some timing issues, but not enough; state and DOM still drifted.

### 3) Flush Hook + Render-Settled Hook
- Added test hooks to flush queued slide renders and wait for next paint.
- Result: Did not fully stabilize; underlying state changes still overrode UI.

### 4) Freeze Slide Renders During Assertions
- Added a test hook to freeze slide render queue to stop DOM from clearing mid-loop.
- Result: Reduced DOM churn, but failures persisted (state still mutated elsewhere).

### 5) JS-Based Scrolling
- Replaced `scrollIntoViewIfNeeded` with JS scrolling of gallery list.
- Result: Improved DOM detachment in some runs but not consistently.

### 6) Test-Mode Rendering (New Strategy)
- Added automatic test-mode detection via `__summarizeTestHooks`.
- Disabled debounced slide rendering in test mode (render immediately).
- Added `awaitRenderSettled` hook (double rAF).
- Result: Some reduction in flake, but state drift still occurred.

### 7) Expose Test Hooks for Labels and DOM Counts
- Added hooks:
  - `getSummarizeLabel()` to read computed label without DOM dependence.
  - `getSlidesDomCount()` to read stable DOM counts.
- Result: Eliminated some DOM-level flake, but core state resets still occurred.

### 8) Instrumentation for Mode Changes
- Added `onModeChange` hook and `getModeChanges()` log to capture state flips.
- Added test attachments to dump logs when tests fail.
- Result: Helped diagnose but introduced new errors when `page` was not in scope.

## What Worked (Partial Wins)

- Polling for async UI values (aria-label) reduced some timing failures.
- Test hooks for direct state/label access avoided fragile DOM assertions.
- Immediate render in test mode reduced slide DOM churn.

## What Did NOT Work

- Retrying alone did not fix flake reliably.
- Simple sleeps / debounce waits were insufficient.
- Flushing renders without controlling state sync still allowed mode drift.
- Freezing slide renders alone did not fix state overrides.

## Root Cause Hypothesis

The tests are fighting the sidepanel state machine:
- Multiple code paths can reset `inputMode`, `inputModeOverride`, and `slidesEnabledValue`.
- Async UI updates (Preact/Zag) and background sync (`updateControls`) override test-intended state.
- DOM is cleared and re-rendered by queued renders during assertions.

## Recommended Next Steps (If Revisited)

1) Add a **test-only state freeze** to block auto-reset paths (e.g., in `updateControls`)
   - Only in test mode.
   - Prevents state reversion while tests run.

2) Use **mode-change logs** to identify exact override paths
   - Keep `getModeChanges()` hook and attach logs only in flaky tests.

3) Consider **dedicated test fixtures** that disable background sync entirely
   - For E2E, favor deterministic, isolated state over production-like behavior.

4) Reduce dependency on UI timings
   - Assert against hooks (label/state) rather than DOM when possible.

## Summary

We improved some failures but did not fully eliminate flake. The consistent theme is that
state resets originate from internal sync paths, not just DOM timing. A test-mode guard on
state mutation (not just rendering) is likely required for full stability.
