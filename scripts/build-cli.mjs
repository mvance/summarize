import { execSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const distDir = path.join(repoRoot, 'dist')
await mkdir(distDir, { recursive: true })

const gitSha = (() => {
  try {
    return execSync('git rev-parse --short=8 HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
})()

await build({
  entryPoints: [path.join(repoRoot, 'src', 'cli.ts')],
  outfile: path.join(distDir, 'cli.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  // Keep builds quiet in CI/prepare; real failures still surface as errors.
  logLevel: 'warning',
  banner: { js: '#!/usr/bin/env node' },
  define: gitSha ? { 'process.env.SUMMARIZE_GIT_SHA': JSON.stringify(gitSha) } : undefined,
  external: ['@steipete/summarize-core', '@steipete/summarize-core/*'],
})
