import type { LlmTokenUsage } from "../../types.js";

export type OpenAiTextCompletionResult = {
  text: string;
  usage: LlmTokenUsage | null;
  resolvedModelId?: string;
};

export type OpenAiTextStreamResult = {
  textStream: AsyncIterable<string>;
  usage: Promise<LlmTokenUsage | null>;
  resolvedModelId?: string;
};

export type OpenAiStructuredOutput = {
  name: string;
  schema: Record<string, unknown>;
};
