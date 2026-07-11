import type { ExecFileException } from "node:child_process";
import type { ExecFileFn } from "../markitdown.js";

type CliExecError = ExecFileException & {
  cmd?: string;
  killed?: boolean;
  signal?: NodeJS.Signals | null;
};

export class CliInterruptedError extends Error {
  readonly exitCode: number;
  readonly silent = true;
  readonly signal: NodeJS.Signals;

  constructor(signal: NodeJS.Signals) {
    super(`Interrupted by ${signal}`);
    this.name = "CliInterruptedError";
    this.signal = signal;
    this.exitCode = signal === "SIGTERM" ? 143 : 130;
  }
}

function toUtf8String(value: string | Buffer): string {
  return typeof value === "string" ? value : value.toString("utf8");
}

function formatErrorMessageWithStderr(
  message: string,
  stderrText: string,
  separator: ": " | "\n" = ": ",
): string {
  const trimmedStderr = stderrText.trim();
  if (!trimmedStderr || message.includes(trimmedStderr)) return message;
  return `${message}${separator}${trimmedStderr}`;
}

function redactSensitiveText(text: string, sensitiveText?: string): string {
  if (!sensitiveText) return text;
  return text.split(sensitiveText).join("[prompt redacted]");
}

function formatTimeoutLabel(timeoutMs: number): string {
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    if (timeoutMs % 60_000 === 0) return `${Math.floor(timeoutMs / 60_000)}m`;
    if (timeoutMs % 1000 === 0) return `${Math.floor(timeoutMs / 1000)}s`;
    return `${Math.floor(timeoutMs)}ms`;
  }
  return "unknown time";
}

function getExecErrorCodeText(error: CliExecError): string {
  if (typeof error.code === "string") return error.code;
  if (Buffer.isBuffer(error.code)) return toUtf8String(error.code);
  if (typeof error.code === "number") return String(error.code);
  return "";
}

function isExecTimeoutError(error: CliExecError): boolean {
  if (getExecErrorCodeText(error).toUpperCase() === "ETIMEDOUT") return true;
  return error.killed === true && error.signal === "SIGTERM";
}

function getExecErrorMessage(error: CliExecError): string {
  return typeof error.message === "string" && error.message.trim().length > 0
    ? error.message.trim()
    : "CLI command failed";
}

function getExecCommand(
  error: CliExecError,
  cmd: string,
  args: string[],
  redactedCommand?: string,
  shouldRedact = false,
): string {
  if (typeof redactedCommand === "string" && redactedCommand.trim().length > 0) {
    return redactedCommand.trim();
  }
  if (shouldRedact) return `${cmd} [arguments redacted]`;
  return typeof error.cmd === "string" && error.cmd.trim().length > 0
    ? error.cmd.trim()
    : [cmd, ...args].join(" ");
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("This operation was aborted", "AbortError");
}

function errorOptions(
  error: CliExecError,
  redactedCommand?: string,
  redactText?: string,
): ErrorOptions | undefined {
  return redactedCommand || redactText ? undefined : { cause: error };
}

export async function execCliWithInput({
  execFileImpl,
  cmd,
  args,
  input,
  timeoutMs,
  env,
  cwd,
  signal,
  redactedCommand,
  redactText,
}: {
  execFileImpl: ExecFileFn;
  cmd: string;
  args: string[];
  input: string;
  timeoutMs: number;
  env: Record<string, string | undefined>;
  cwd?: string;
  signal?: AbortSignal;
  redactedCommand?: string;
  redactText?: string;
}): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    let interruptedSignal: NodeJS.Signals | null = null;
    let aborted = false;
    let child: ReturnType<ExecFileFn> | null = null;
    const forwardSignal = (signal: NodeJS.Signals) => {
      if (interruptedSignal) return;
      interruptedSignal = signal;
      try {
        child?.kill(signal);
      } catch {
        // Process may have already exited between signal delivery and forwarding.
      }
    };
    const handleSigint = () => forwardSignal("SIGINT");
    const handleSigterm = () => forwardSignal("SIGTERM");
    const handleAbort = () => {
      if (aborted) return;
      aborted = true;
      try {
        child?.kill("SIGTERM");
      } catch {
        // Process may have already exited between cancellation and forwarding.
      }
    };
    const cleanupSignalHandlers = () => {
      process.removeListener("SIGINT", handleSigint);
      process.removeListener("SIGTERM", handleSigterm);
      signal?.removeEventListener("abort", handleAbort);
    };

    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    // Run before progress UI exit handlers so active CLI backends don't survive Ctrl+C.
    process.prependOnceListener("SIGINT", handleSigint);
    process.prependOnceListener("SIGTERM", handleSigterm);
    signal?.addEventListener("abort", handleAbort, { once: true });

    child = execFileImpl(
      cmd,
      args,
      {
        timeout: timeoutMs,
        env: { ...process.env, ...env },
        cwd,
        maxBuffer: 50 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        cleanupSignalHandlers();
        const shouldRedact = Boolean(redactedCommand || redactText);
        const stderrText = redactSensitiveText(toUtf8String(stderr), redactText);
        if (aborted && signal) {
          reject(abortReason(signal));
          return;
        }
        if (interruptedSignal) {
          reject(new CliInterruptedError(interruptedSignal));
          return;
        }
        if (error) {
          if (isExecTimeoutError(error)) {
            const timeoutMessage =
              `CLI command timed out after ${formatTimeoutLabel(timeoutMs)}: ${getExecCommand(error, cmd, args, redactedCommand, shouldRedact)}. ` +
              "Increase --timeout (e.g. 5m).";
            reject(
              new Error(formatErrorMessageWithStderr(timeoutMessage, stderrText, "\n"), {
                ...errorOptions(error, redactedCommand, redactText),
              }),
            );
            return;
          }
          const errorMessage =
            shouldRedact && redactedCommand
              ? `CLI command failed: ${redactedCommand}`
              : shouldRedact
                ? "CLI command failed"
                : getExecErrorMessage(error);
          reject(
            new Error(
              formatErrorMessageWithStderr(
                redactSensitiveText(errorMessage, redactText),
                stderrText,
              ),
              errorOptions(error, redactedCommand, redactText),
            ),
          );
          return;
        }
        resolve({ stdout: toUtf8String(stdout), stderr: stderrText });
      },
    );

    if (aborted) {
      try {
        child.kill("SIGTERM");
      } catch {
        // Process may have exited synchronously in an injected exec implementation.
      }
    }

    if (child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}
