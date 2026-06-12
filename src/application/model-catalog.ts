import type { ModelConfig } from "../config.js";

export const GPT_FAST_MODEL_ID = "openai/gpt-5.5";
export const CODEX_GPT_FAST_MODEL_ID = "cli/codex/gpt-fast";

export const BUILTIN_MODELS: Record<string, ModelConfig> = {
  "gpt-fast": {
    id: GPT_FAST_MODEL_ID,
    serviceTier: "fast",
    reasoningEffort: "medium",
  },
  fast: {
    id: GPT_FAST_MODEL_ID,
    serviceTier: "fast",
    reasoningEffort: "medium",
  },
  "codex-fast": {
    id: CODEX_GPT_FAST_MODEL_ID,
  },
  free: {
    mode: "auto",
    rules: [
      {
        candidates: [
          // Snapshot (2025-12-23): generated via `summarize refresh-free`.
          "openrouter/xiaomi/mimo-v2-flash:free",
          "openrouter/mistralai/devstral-2512:free",
          "openrouter/qwen/qwen3-coder:free",
          "openrouter/kwaipilot/kat-coder-pro:free",
          "openrouter/moonshotai/kimi-k2:free",
          "openrouter/nex-agi/deepseek-v3.1-nex-n1:free",
        ],
      },
    ],
  },
};
