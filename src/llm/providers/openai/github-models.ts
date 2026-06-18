import {
  resolveGitHubModelsCompatFallbackModelId,
  shouldRetryGitHubModelsCompat,
} from "../../github-models.js";
import { completeOpenAiChatText } from "./chat-completions.js";
import type { OpenAiTextCompletionResult, OpenAiTextRequest } from "./types.js";

export async function completeGitHubModelsText(
  request: OpenAiTextRequest,
): Promise<OpenAiTextCompletionResult> {
  try {
    return await completeOpenAiChatText(request);
  } catch (error) {
    const fallbackModelId = resolveGitHubModelsCompatFallbackModelId(request.modelId);
    if (!fallbackModelId || !shouldRetryGitHubModelsCompat(error)) {
      throw error;
    }
    return completeOpenAiChatText({
      ...request,
      modelId: fallbackModelId,
    });
  }
}
