import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execCliWithInput } from "../cli-exec.js";
import type { CliRunResult, ResolvedCliRunOptions } from "./types.js";

function hasAnyFlag(args: string[], flags: string[]): boolean {
  return args.some((arg) => flags.some((flag) => arg === flag || arg.startsWith(`${flag}=`)));
}

const AGY_MAX_PRINT_ARG_BYTES = 120 * 1024;
const AGY_WINDOWS_MAX_PRINT_ARG_CHARS = 25_000;

export type AgyPrintArgLimit = { limit: number; type: "bytes" | "chars" };

export function resolveAgyMaxPrintArgLimit(
  platform: NodeJS.Platform = typeof process !== "undefined" ? process.platform : "linux",
): AgyPrintArgLimit {
  return platform === "win32"
    ? { limit: AGY_WINDOWS_MAX_PRINT_ARG_CHARS, type: "chars" }
    : { limit: AGY_MAX_PRINT_ARG_BYTES, type: "bytes" };
}

export async function runCopilotCli(options: ResolvedCliRunOptions): Promise<CliRunResult> {
  const args = [...options.providerExtraArgs, "-p", options.prompt];
  if (options.allowTools) args.push("--allow-all-tools");
  if (options.requestedModel) args.push("--model", options.requestedModel);
  const { stdout } = await execCliWithInput({
    execFileImpl: options.execFileImpl,
    cmd: options.binary,
    args,
    input: "",
    timeoutMs: options.timeoutMs,
    env: options.env,
    cwd: options.cwd,
    signal: options.signal,
  });
  const text = stdout.trim();
  if (!text) throw new Error("CLI returned empty output");
  return { text, usage: null, costUsd: null };
}

export async function runAgyCli(options: ResolvedCliRunOptions): Promise<CliRunResult> {
  const isolatedCwd = !options.allowTools
    ? await fs.mkdtemp(path.join(tmpdir(), "summarize-agy-"))
    : null;
  try {
    const args = [...options.providerExtraArgs];
    if (!options.allowTools && !hasAnyFlag(args, ["--sandbox"])) args.push("--sandbox");
    const { limit, type } = resolveAgyMaxPrintArgLimit();
    const promptSize =
      type === "chars" ? options.prompt.length : new TextEncoder().encode(options.prompt).length;
    if (promptSize > limit) {
      throw new Error(
        `Antigravity CLI requires --print <prompt> and cannot safely receive large prompts over argv (${promptSize} ${type}). ` +
          "Use a different CLI provider for this input, reduce extracted content, or update agy to support stdin/file input.",
      );
    }
    if (
      Number.isFinite(options.timeoutMs) &&
      options.timeoutMs > 0 &&
      !hasAnyFlag(args, ["--print-timeout", "-print-timeout"])
    ) {
      args.push("--print-timeout", `${Math.max(1, Math.ceil(options.timeoutMs / 1000))}s`);
    }
    args.push("--print", options.prompt);
    const timeoutCommand = [
      options.binary,
      ...args.map((arg, index) => (args[index - 1] === "--print" ? "[prompt redacted]" : arg)),
    ].join(" ");
    const { stdout } = await execCliWithInput({
      execFileImpl: options.execFileImpl,
      cmd: options.binary,
      args,
      input: "",
      timeoutMs: options.timeoutMs,
      env: options.env,
      cwd: isolatedCwd ?? options.cwd,
      signal: options.signal,
      timeoutCommand,
    });
    const text = stdout.trim();
    if (!text) throw new Error("CLI returned empty output");
    return { text, usage: null, costUsd: null };
  } finally {
    if (isolatedCwd) await fs.rm(isolatedCwd, { recursive: true, force: true }).catch(() => {});
  }
}
