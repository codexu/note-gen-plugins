import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plugin = join(workspace, 'plugins', 'terminal')
const sdk = join(workspace, '.sdk')
const cli = join(sdk, 'packages', 'plugin-cli', 'dist', 'bin.js')
const children = new Set()
let stopping = false

function start(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env })
  children.add(child)
  child.once('exit', (code, signal) => {
    children.delete(child)
    if (!stopping) {
      console.error(`${name} stopped (${signal ?? code ?? 'unknown'}); stopping local development.`)
      stop(code || 1)
    }
  })
  child.once('error', error => {
    console.error(`${name}: ${error.message}`)
    stop(1)
  })
  return child
}

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

try {
  await access(sdk)
  start('SDK watch', 'pnpm', ['dev'], sdk)
  start('terminal view watch', 'pnpm', [
    'exec', 'esbuild', 'src/terminal-frame.ts', '--bundle', '--format=iife',
    '--platform=browser', '--target=es2022', '--minify', '--outdir=dist', '--watch=forever',
  ], plugin)

  // The SDK TypeScript watchers create this file on a fresh checkout. Node's
  // watch mode then restarts the CLI whenever its compiled SDK imports change.
  while (!stopping) {
    try { await access(cli); break }
    catch { await new Promise(resolveWait => setTimeout(resolveWait, 250)) }
  }
  if (!stopping) {
    start('plugin watch', process.execPath, ['--watch', cli, 'dev', plugin], plugin)
    console.log(`Watching SDK and terminal plugin. Import ${plugin} once in NoteGen Developer Mode.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  stop(1)
}
