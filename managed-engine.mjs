import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import { childEnvironment, engineVersion, findEngine } from './engine.mjs'

const exec = promisify(execFile)
const registry = 'https://registry.npmjs.org/'
const packageName = '@minimax-ai/code'
const versionPattern = /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/
const releasePattern = /^release-[a-zA-Z0-9]+$/
const cli = prefix => join(prefix, 'node_modules', '@minimax-ai', 'code', 'cli.js')
const operations = new Map()

async function readable(path) {
  try { await access(path); return true } catch { return false }
}

function nodeCandidates() {
  const paths = (process.env.PATH || '').split(delimiter).filter(isAbsolute)
  const executable = process.platform === 'win32' ? 'node.exe' : 'node'
  return [...new Set([
    process.env.HERMES_AGENT_NODE, ...(!process.versions.electron ? [process.execPath] : []),
    ...paths.map(dir => join(dir, executable)),
  ].filter(path => path && isAbsolute(path)))]
}

async function nodeRuntime(signal, needsNpm = false) {
  for (const path of nodeCandidates()) {
    signal.throwIfAborted()
    if (!await readable(path)) continue
    const node = await realpath(path)
    const bin = dirname(node)
    const npmPaths = [
      join(bin, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ]
    if (process.platform !== 'win32') {
      const npm = join(dirname(path), 'npm')
      if (await readable(npm)) {
        const resolved = await realpath(npm)
        if (resolved.endsWith('.js')) npmPaths.push(resolved)
      }
    }
    try {
      const { stdout } = await exec(node, ['--version'], { signal, timeout: 5000, windowsHide: true })
      const [, major, minor] = stdout.trim().match(/^v(\d+)\.(\d+)\./) || []
      if (!(Number(major) >= 24 && Number(major) < 27 || major === '22' && Number(minor) >= 19)) continue
    } catch {
      signal.throwIfAborted()
      continue
    }
    if (!needsNpm) return { node }
    for (const npm of npmPaths) if (await readable(npm)) return { node, npm }
  }
  throw new Error(needsNpm ? 'A supported Node.js installation with npm is required on the Studio host.' : 'A supported Node.js installation is required on the Studio host.')
}

async function readSelection(root) {
  let value
  try { value = JSON.parse(await readFile(join(root, 'current.json'), 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw new Error('Could not read the Studio-managed MiniMax Code engine selection.')
  }
  if (value === null || typeof value === 'string' && releasePattern.test(value)) return value
  throw new Error('The Studio-managed MiniMax Code engine selection is invalid.')
}

async function writeSelection(root, value) {
  const temp = join(root, `.selection-${randomUUID()}`)
  try {
    await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' })
    await rename(temp, join(root, 'current.json'))
  } finally {
    await rm(temp, { force: true })
  }
}

function serialize(root, task) {
  const previous = operations.get(root) || Promise.resolve()
  const operation = previous.catch(() => {}).then(task)
  operations.set(root, operation)
  return operation.finally(() => {
    if (operations.get(root) === operation) operations.delete(root)
  })
}

async function latestVersion(signal) {
  const response = await fetch(`${registry}@minimax-ai%2fcode/latest`, {
    redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!response.ok) throw new Error('Could not check MiniMax Code versions on npm.')
  const info = await response.json()
  if (info.name !== packageName || typeof info.version !== 'string' || !versionPattern.test(info.version)) {
    throw new Error('The official npm registry did not return a valid MiniMax Code version.')
  }
  return info.version
}

export function managedEngine(dataDir, configuredExecutable = async () => '') {
  const root = join(dataDir, 'engine')
  const externalOverride = async () => process.env.EKKO_MINIMAX_CODE_EXECUTABLE?.trim() || await configuredExecutable()

  async function resolve(signal) {
    const override = await externalOverride()
    if (override) return { engine: await findEngine({ ...process.env, EKKO_MINIMAX_CODE_EXECUTABLE: override }), source: 'external' }
    const release = await readSelection(root)
    if (release === undefined) {
      const engine = await findEngine()
      return engine ? { engine, source: 'external' } : { source: 'managed' }
    }
    if (release === null) return { source: 'managed' }
    const entry = cli(join(root, release))
    if (!await readable(entry)) return { source: 'managed' }
    return { engine: { executable: (await nodeRuntime(signal, true)).node, prefix: [entry] }, source: 'managed' }
  }

  async function status(signal) {
    try {
      const { engine, source } = await resolve(signal)
      if (!engine) return { installed: false, version: '', source: source === 'external' ? 'not-installed' : source }
      const version = await engineVersion(engine, childEnvironment(), signal)
      if (version) return { installed: true, version, source }
      return { installed: false, version: '', source, error: 'Could not confirm the MiniMax Code CLI version.' }
    } catch (error) {
      signal.throwIfAborted()
      return { installed: false, version: '', source: 'error', error: 'Could not read or start the MiniMax Code CLI.' }
    }
  }

  async function checkUpdate(run) {
    const tool = await status(run.signal)
    if (tool.source === 'external' || tool.source === 'not-installed') {
      return { currentVersion: tool.version, latestVersion: tool.version, updateAvailable: false, message: 'This MiniMax Code installation is managed outside Studio.' }
    }
    const latest = await latestVersion(run.signal)
    return { currentVersion: tool.version, latestVersion: latest, updateAvailable: latest !== tool.version }
  }

  function upgrade(input, run) {
    return serialize(root, async () => {
      if (!versionPattern.test(input.version)) throw new Error('Choose a published MiniMax Code version.')
      const current = await status(run.signal)
      if (current.source === 'external' || current.source === 'not-installed') throw new Error('This MiniMax Code installation is managed outside Studio.')
      if (current.version !== input.expectedVersion) throw new Error('MiniMax Code version changed. Check updates again.')
      const previous = await readSelection(root)
      const { node, npm } = await nodeRuntime(run.signal, true)
      await mkdir(root, { recursive: true, mode: 0o700 })
      const stage = await mkdtemp(join(root, 'release-'))
      let selected = false
      try {
        const env = childEnvironment()
        // npm lifecycle scripts must resolve the same plain Node used by the engine.
        const pathKey = Object.keys(env).find(name => name.toUpperCase() === 'PATH') ?? 'PATH'
        env[pathKey] = [dirname(node), env[pathKey]].filter(Boolean).join(delimiter)
        const options = { cwd: stage, env, signal: run.signal, windowsHide: true, maxBuffer: 512 * 1024 }
        const npmrc = join(stage, '.studio-npmrc')
        await writeFile(npmrc, '', { mode: 0o600 })
        run.progress({ message: 'Installing MiniMax Code from npm', percent: 15 })
        try {
          await exec(node, [npm, 'install', '--prefix', stage, '--registry', registry,
            '--userconfig', npmrc, '--globalconfig', join(stage, '.studio-global-npmrc'), '--cache', join(stage, '.npm-cache'),
            '--include=optional', '--ignore-scripts=false', '--allow-scripts=@minimax-ai/code,better-sqlite3',
            '--no-audit', '--no-fund', `${packageName}@${input.version}`], { ...options, timeout: 300000 })
        } catch {
          run.signal.throwIfAborted()
          throw new Error('npm could not install MiniMax Code and its native SQLite dependency.')
        }
        run.progress({ message: 'Verifying MiniMax Code and SQLite', percent: 85 })
        const entry = cli(stage)
        const version = await engineVersion({ executable: node, prefix: [entry] }, env, run.signal)
        if (version !== input.version) throw new Error('The installed CLI version did not match the requested MiniMax Code version.')
        try {
          await exec(node, ['--input-type=commonjs', '-e',
            'const db = new (require("node:module").createRequire(process.argv[1])("better-sqlite3"))(":memory:"); db.close()', entry],
          { ...options, timeout: 15000 })
        } catch {
          run.signal.throwIfAborted()
          throw new Error('MiniMax Code native SQLite verification failed.')
        }
        await rm(join(stage, '.npm-cache'), { recursive: true, force: true, maxRetries: 3 })
        run.signal.throwIfAborted()
        await writeSelection(root, stage.slice(root.length + 1))
        selected = true
        if (previous) await rm(join(root, previous), { recursive: true, force: true, maxRetries: 3 }).catch(() => {})
        return { installedVersion: version }
      } finally {
        if (!selected) await rm(stage, { recursive: true, force: true, maxRetries: 3 }).catch(() => {})
      }
    })
  }

  function remove(run) {
    return serialize(root, async () => {
      if (await externalOverride()) throw new Error('This MiniMax Code installation is managed outside Studio.')
      const release = await readSelection(root)
      if (release === undefined && await findEngine()) throw new Error('This MiniMax Code installation is managed outside Studio.')
      if (!release) return
      run.signal.throwIfAborted()
      await writeSelection(root, null)
      await rm(join(root, release), { recursive: true, force: true, maxRetries: 3 })
    })
  }

  return { resolve, status, checkUpdate, upgrade, remove }
}
