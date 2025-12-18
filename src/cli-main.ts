import { runCli } from './run.js'

export type CliMainArgs = {
  argv: string[]
  env: Record<string, string | undefined>
  fetch: typeof fetch
  stdout: NodeJS.WritableStream
  stderr: NodeJS.WritableStream
  exit: (code: number) => void
  setExitCode: (code: number) => void
}

export function handlePipeErrors(stream: NodeJS.WritableStream, exit: (code: number) => void) {
  stream.on('error', (error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code
    if (code === 'EPIPE') {
      exit(0)
      return
    }
    throw error
  })
}

function stripAnsi(input: string): string {
  // Minimal, good-enough ANSI stripper for error output. We only use this for non-verbose errors.
  return input.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, '')
}

export async function runCliMain({
  argv,
  env,
  fetch,
  stdout,
  stderr,
  exit,
  setExitCode,
}: CliMainArgs): Promise<void> {
  handlePipeErrors(stdout, exit)
  handlePipeErrors(stderr, exit)

  const verbose = argv.includes('--verbose') || argv.includes('--verbose=true')

  try {
    await runCli(argv, { env, fetch, stdout, stderr })
  } catch (error: unknown) {
    const isTty = Boolean((stderr as unknown as { isTTY?: boolean }).isTTY)
    if (isTty) stderr.write('\n')

    if (verbose && error instanceof Error && typeof error.stack === 'string') {
      stderr.write(`${error.stack}\n`)
      const cause = (error as Error & { cause?: unknown }).cause
      if (cause instanceof Error && typeof cause.stack === 'string') {
        stderr.write(`Caused by: ${cause.stack}\n`)
      }
      setExitCode(1)
      return
    }

    const message =
      error instanceof Error ? error.message : error ? String(error) : 'Unknown error'
    stderr.write(`${stripAnsi(message)}\n`)
    setExitCode(1)
  }
}
