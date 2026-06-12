import type { Context } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai";
import type { Attachment } from "../attachments.js";
import { createUnsupportedFunctionalityError } from "../errors.js";
export {
  resolveOpenAiClientConfig,
  type OpenAiClientConfigInput,
} from "../openai-client-config.js";
import type { LlmTokenUsage } from "../types.js";
import { normalizeOpenAiUsage, normalizeTokenUsage } from "../usage.js";
import { resolveOpenAiModel } from "./models.js";
import {
  buildOpenAiChatRequestOptions,
  buildOpenAiResponsesRequestOptions,
  isOpenAiResponsesTextModelId,
} from "./openai/request-options.js";
import { createDeferredUsage, parseOpenAiSseJsonStream } from "./openai/sse.js";
import {
  buildOpenAiRequestHeaders,
  contextToChatCompletionMessages,
  contextToResponsesInput,
  createOpenAiHttpError,
  isApiOpenAiBaseUrl,
  isGitHubModelsBaseUrl,
  resolveOpenAiChatCompletionsUrl,
  resolveOpenAiResponsesUrl,
} from "./openai/transport.js";
import type {
  OpenAiStructuredOutput,
  OpenAiTextCompletionResult,
  OpenAiTextStreamResult,
} from "./openai/types.js";
import { bytesToBase64 } from "./shared.js";
import type { OpenAiClientConfig } from "./types.js";

export type { OpenAiStructuredOutput } from "./openai/types.js";

function resolveGitHubModelsCompatFallbackModelId(modelId: string): string | null {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized.startsWith("openai/gpt-5") || normalized === "openai/gpt-5-chat") {
    return null;
  }
  return "openai/gpt-5-chat";
}

function shouldRetryGitHubModelsCompat(error: unknown): boolean {
  const statusCode =
    typeof (error as { statusCode?: unknown })?.statusCode === "number"
      ? Number((error as { statusCode?: unknown }).statusCode)
      : null;
  return statusCode === 400 || statusCode === 404 || statusCode === 500 || statusCode === 502;
}

function extractOpenAiResponseText(payload: {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}): string {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const text = output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("")
    .trim();
  return text;
}

function extractChatCompletionText(payload: {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const content = choices[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .join("")
    .trim();
}

function extractOpenAiResponsesStreamUsage(payload: Record<string, unknown>): LlmTokenUsage | null {
  const response = payload.response;
  const usage =
    response && typeof response === "object"
      ? (response as Record<string, unknown>).usage
      : payload.usage;
  return normalizeOpenAiUsage(usage);
}

async function completeOpenAiChatText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
}): Promise<OpenAiTextCompletionResult> {
  const baseUrl = openaiConfig.baseURL ?? "https://api.openai.com/v1";
  const response = await fetchImpl(String(resolveOpenAiChatCompletionsUrl(baseUrl)), {
    method: "POST",
    headers: buildOpenAiRequestHeaders(openaiConfig),
    body: JSON.stringify({
      model: modelId,
      messages: contextToChatCompletionMessages(context),
      ...buildOpenAiChatRequestOptions(openaiConfig.requestOptions),
      ...(typeof maxOutputTokens === "number" ? { max_tokens: maxOutputTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    }),
    signal,
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw createOpenAiHttpError({ baseUrl, status: response.status, bodyText });
  }

  const data = JSON.parse(bodyText) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: unknown;
  };
  const text = extractChatCompletionText(data);
  if (!text) throw new Error(`LLM returned an empty summary (model openai/${modelId}).`);
  return { text, usage: normalizeOpenAiUsage(data.usage), resolvedModelId: modelId };
}

async function completeOpenAiResponsesText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl,
  structuredOutput,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
  structuredOutput?: OpenAiStructuredOutput;
}): Promise<OpenAiTextCompletionResult> {
  const baseUrl = openaiConfig.baseURL ?? "https://api.openai.com/v1";
  const response = await fetchImpl(String(resolveOpenAiResponsesUrl(baseUrl)), {
    method: "POST",
    headers: buildOpenAiRequestHeaders(openaiConfig),
    body: JSON.stringify({
      model: modelId,
      input: contextToResponsesInput(context),
      ...(context.systemPrompt?.trim() ? { instructions: context.systemPrompt.trim() } : {}),
      ...buildOpenAiResponsesRequestOptions(openaiConfig.requestOptions, structuredOutput),
      ...(typeof maxOutputTokens === "number" ? { max_output_tokens: maxOutputTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    }),
    signal,
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw createOpenAiHttpError({ baseUrl, status: response.status, bodyText });
  }

  const data = JSON.parse(bodyText) as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: string }> }>;
    usage?: unknown;
  };
  const text = extractOpenAiResponseText(data);
  if (!text) throw new Error(`LLM returned an empty summary (model openai/${modelId}).`);
  return { text, usage: normalizeOpenAiUsage(data.usage), resolvedModelId: modelId };
}

async function streamOpenAiResponsesText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
}): Promise<OpenAiTextStreamResult> {
  const baseUrl = openaiConfig.baseURL ?? "https://api.openai.com/v1";
  const response = await fetchImpl(String(resolveOpenAiResponsesUrl(baseUrl)), {
    method: "POST",
    headers: buildOpenAiRequestHeaders(openaiConfig),
    body: JSON.stringify({
      model: modelId,
      input: contextToResponsesInput(context),
      ...(context.systemPrompt?.trim() ? { instructions: context.systemPrompt.trim() } : {}),
      ...buildOpenAiResponsesRequestOptions(openaiConfig.requestOptions),
      stream: true,
      ...(typeof maxOutputTokens === "number" ? { max_output_tokens: maxOutputTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw createOpenAiHttpError({ baseUrl, status: response.status, bodyText });
  }
  if (!response.body) {
    throw new Error("OpenAI stream response was empty.");
  }

  const usage = createDeferredUsage();
  const textStream = {
    async *[Symbol.asyncIterator]() {
      let finalUsage: LlmTokenUsage | null = null;
      try {
        for await (const event of parseOpenAiSseJsonStream(response.body!)) {
          const type = typeof event.type === "string" ? event.type : "";
          if (type === "response.output_text.delta" && typeof event.delta === "string") {
            yield event.delta;
            continue;
          }
          if (type === "response.completed") {
            finalUsage = extractOpenAiResponsesStreamUsage(event);
            continue;
          }
          if (type === "response.failed" || type === "error") {
            const error = event.error;
            const message =
              error &&
              typeof error === "object" &&
              typeof (error as { message?: unknown }).message === "string"
                ? String((error as { message?: unknown }).message)
                : "OpenAI stream failed.";
            throw new Error(message);
          }
        }
      } finally {
        usage.resolve(finalUsage);
      }
    },
  };

  return { textStream, usage: usage.promise, resolvedModelId: modelId };
}

async function streamOpenAiChatText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
}): Promise<OpenAiTextStreamResult> {
  const baseUrl = openaiConfig.baseURL ?? "https://api.openai.com/v1";
  const response = await fetchImpl(String(resolveOpenAiChatCompletionsUrl(baseUrl)), {
    method: "POST",
    headers: buildOpenAiRequestHeaders(openaiConfig),
    body: JSON.stringify({
      model: modelId,
      messages: contextToChatCompletionMessages(context),
      ...buildOpenAiChatRequestOptions(openaiConfig.requestOptions),
      stream: true,
      stream_options: { include_usage: true },
      ...(typeof maxOutputTokens === "number" ? { max_tokens: maxOutputTokens } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw createOpenAiHttpError({ baseUrl, status: response.status, bodyText });
  }
  if (!response.body) {
    throw new Error("OpenAI stream response was empty.");
  }

  const usage = createDeferredUsage();
  const textStream = {
    async *[Symbol.asyncIterator]() {
      let finalUsage: LlmTokenUsage | null = null;
      try {
        for await (const event of parseOpenAiSseJsonStream(response.body!)) {
          if (event.error) {
            const error = event.error;
            const message =
              error &&
              typeof error === "object" &&
              typeof (error as { message?: unknown }).message === "string"
                ? String((error as { message?: unknown }).message)
                : "OpenAI stream failed.";
            throw new Error(message);
          }
          if (event.usage) finalUsage = normalizeOpenAiUsage(event.usage);
          const choices = Array.isArray(event.choices) ? event.choices : [];
          const delta = choices[0]?.delta;
          const content =
            delta && typeof delta === "object" ? (delta as { content?: unknown }).content : null;
          if (typeof content === "string") yield content;
        }
      } finally {
        usage.resolve(finalUsage);
      }
    },
  };

  return { textStream, usage: usage.promise, resolvedModelId: modelId };
}

async function completeGitHubModelsText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
}): Promise<OpenAiTextCompletionResult> {
  try {
    return await completeOpenAiChatText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  } catch (error) {
    const fallbackModelId = resolveGitHubModelsCompatFallbackModelId(modelId);
    if (!fallbackModelId || !shouldRetryGitHubModelsCompat(error)) {
      throw error;
    }
    return completeOpenAiChatText({
      modelId: fallbackModelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
}

export async function completeOpenAiText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl = globalThis.fetch.bind(globalThis),
  structuredOutput,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  structuredOutput?: OpenAiStructuredOutput;
}): Promise<OpenAiTextCompletionResult> {
  if (structuredOutput) {
    if (openaiConfig.isOpenRouter || isGitHubModelsBaseUrl(openaiConfig.baseURL)) {
      throw new Error(
        "Structured OpenAI Responses output requires an OpenAI-compatible Responses endpoint.",
      );
    }
    return completeOpenAiResponsesText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
      structuredOutput,
    });
  }
  if (isGitHubModelsBaseUrl(openaiConfig.baseURL)) {
    return completeGitHubModelsText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
  if (
    openaiConfig.useChatCompletions &&
    openaiConfig.requestOptions &&
    !openaiConfig.isOpenRouter &&
    isApiOpenAiBaseUrl(openaiConfig.baseURL)
  ) {
    return completeOpenAiChatText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
  if (openaiConfig.isOpenRouter && isOpenAiResponsesTextModelId(modelId)) {
    return completeOpenAiChatText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
  if (
    !openaiConfig.isOpenRouter &&
    isApiOpenAiBaseUrl(openaiConfig.baseURL) &&
    isOpenAiResponsesTextModelId(modelId)
  ) {
    return completeOpenAiResponsesText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
  const model = resolveOpenAiModel({ modelId, context, openaiConfig });
  const result = await completeSimple(model, context, {
    ...(typeof temperature === "number" ? { temperature } : {}),
    ...(typeof maxOutputTokens === "number" ? { maxTokens: maxOutputTokens } : {}),
    apiKey: openaiConfig.apiKey,
    signal,
  });
  const text = result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
  if (!text) throw new Error(`LLM returned an empty summary (model openai/${modelId}).`);
  return { text, usage: normalizeTokenUsage(result.usage) };
}

export async function streamOpenAiText({
  modelId,
  openaiConfig,
  context,
  temperature,
  maxOutputTokens,
  signal,
  fetchImpl = globalThis.fetch.bind(globalThis),
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  context: Context;
  temperature?: number;
  maxOutputTokens?: number;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<OpenAiTextStreamResult | null> {
  if (
    openaiConfig.useChatCompletions &&
    openaiConfig.requestOptions &&
    !openaiConfig.isOpenRouter &&
    isApiOpenAiBaseUrl(openaiConfig.baseURL)
  ) {
    return streamOpenAiChatText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
  if (
    !openaiConfig.isOpenRouter &&
    isApiOpenAiBaseUrl(openaiConfig.baseURL) &&
    isOpenAiResponsesTextModelId(modelId)
  ) {
    return streamOpenAiResponsesText({
      modelId,
      openaiConfig,
      context,
      temperature,
      maxOutputTokens,
      signal,
      fetchImpl,
    });
  }
  return null;
}

export async function completeOpenAiDocument({
  modelId,
  openaiConfig,
  promptText,
  document,
  maxOutputTokens,
  temperature,
  timeoutMs,
  fetchImpl,
}: {
  modelId: string;
  openaiConfig: OpenAiClientConfig;
  promptText: string;
  document: Attachment;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}): Promise<{ text: string; usage: LlmTokenUsage | null }> {
  if (document.kind !== "document") {
    throw new Error("Internal error: expected a document attachment for OpenAI.");
  }
  if (openaiConfig.isOpenRouter) {
    throw createUnsupportedFunctionalityError(
      "OpenRouter does not support PDF attachments for openai/... models",
    );
  }
  const baseUrl = openaiConfig.baseURL ?? "https://api.openai.com/v1";
  const host = new URL(baseUrl).host;
  if (host !== "api.openai.com") {
    throw createUnsupportedFunctionalityError(
      `Document attachments require api.openai.com; got ${host}`,
    );
  }

  const url = resolveOpenAiResponsesUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const filename = document.filename?.trim() || "document.pdf";
  const payload = {
    model: modelId,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename,
            file_data: `data:${document.mediaType};base64,${bytesToBase64(document.bytes)}`,
          },
          { type: "input_text", text: promptText },
        ],
      },
    ],
    ...buildOpenAiResponsesRequestOptions(openaiConfig.requestOptions),
    ...(typeof maxOutputTokens === "number" ? { max_output_tokens: maxOutputTokens } : {}),
    ...(typeof temperature === "number" ? { temperature } : {}),
  };

  try {
    const response = await fetchImpl(String(url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openaiConfig.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw createOpenAiHttpError({ baseUrl, status: response.status, bodyText });
    }

    const data = JSON.parse(bodyText) as {
      output_text?: unknown;
      output?: Array<{ content?: Array<{ text?: string }> }>;
      usage?: unknown;
    };
    const text = extractOpenAiResponseText(data);
    if (!text) {
      throw new Error(`LLM returned an empty summary (model openai/${modelId}).`);
    }
    return { text, usage: normalizeOpenAiUsage(data.usage) };
  } finally {
    clearTimeout(timeout);
  }
}
