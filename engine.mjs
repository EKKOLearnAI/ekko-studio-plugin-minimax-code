import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const allowedEnvironment = /^(PATH|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|SYSTEMROOT|WINDIR|SYSTEMDRIVE|COMSPEC|PATHEXT|TEMP|TMP|TMPDIR|LANG|LC_[A-Z_]+|USER|LOGNAME|USERNAME|SSL_CERT_FILE|SSL_CERT_DIR|NODE_EXTRA_CA_CERTS|MCODE_DISABLE_TELEMETRY|DO_NOT_TRACK)$/i
const jsEntry = /\.(?:cjs|mjs|js)$/i

export function executableCandidates(env, home, platform) {
  const windows = platform === 'win32'
  const path = windows ? win32 : posix
  const override = env.EKKO_MINIMAX_CODE_EXECUTABLE?.trim()
  if (override) {
    if (!path.isAbsolute(override) || windows && !/\.(?:exe|cjs|mjs|js)$/i.test(override)) {
      throw new Error('Set EKKO_MINIMAX_CODE_EXECUTABLE to an absolute CLI binary or JavaScript entry path.')
    }
    return [override]
  }

  const directories = (env.PATH ?? '').split(path.delimiter).filter(dir => path.isAbsolute(dir))
  if (windows) {
    if (env.APPDATA && path.isAbsolute(env.APPDATA)) directories.push(path.join(env.APPDATA, 'npm'))
    return [...new Set(directories.flatMap(dir => [
      path.join(dir, 'mcode.exe'),
      path.join(dir, 'node_modules', '@minimax-ai', 'code', 'cli.js'),
    ]))]
  }
  directories.push(path.join(home, '.local', 'bin'), path.join(home, '.minimax-code', 'bin'))
  return [...new Set(directories.map(dir => path.join(dir, 'mcode')))]
}

export function childEnvironment(source = process.env, home = homedir(), platform = process.platform) {
  const path = platform === 'win32' ? win32 : posix
  const env = Object.fromEntries(Object.entries(source).filter(([name]) => allowedEnvironment.test(name)))
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1'
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') ?? 'PATH'
  env[pathKey] = (env[pathKey] ?? '').split(path.delimiter).filter(dir => path.isAbsolute(dir)).join(path.delimiter)
  const dataDir = source.MINIMAX_DATA_DIR?.trim() || source.MAVIS_DATA_DIR?.trim() || path.join(home, '.minimax')
  if (!path.isAbsolute(dataDir)) throw new Error('Use an absolute MiniMax Code data directory on the Studio host.')
  env.MINIMAX_DATA_DIR = path.normalize(dataDir)
  return env
}

export async function findEngine(source = process.env, home = homedir(), platform = process.platform) {
  const pathVar = Object.keys(source).find(key => key.toUpperCase() === 'PATH') ?? 'PATH'
  const candidates = executableCandidates({ ...source, PATH: source[pathVar] }, home, platform)
  for (const entry of candidates) {
    try {
      if (!(await stat(entry)).isFile()) continue
      const script = jsEntry.test(entry)
      await access(entry, script || platform === 'win32' ? constants.R_OK : constants.X_OK)
      return { executable: script ? process.execPath : entry, prefix: script ? [entry] : [] }
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error
    }
  }
  return undefined
}

export async function engineVersion(engine, env, signal) {
  const { stdout } = await exec(engine.executable, [...engine.prefix, '--version'], {
    shell: false, windowsHide: true, env, signal, timeout: 5_000, maxBuffer: 4096,
  })
  return stdout.trim().match(/^v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/)?.[1] ?? ''
}

export function engineLoginCommand(engine, dataDir, platform = process.platform) {
  if (!engine) return ''
  const args = [engine.executable, ...engine.prefix, 'login']
  if (platform === 'win32') {
    const quote = value => "'" + value.replaceAll("'", "''") + "'"
    return `$env:MINIMAX_DATA_DIR = ${quote(dataDir)}; & ${args.map(quote).join(' ')}`
  }
  const quote = value => "'" + value.replaceAll("'", "'\"'\"'") + "'"
  return `MINIMAX_DATA_DIR=${quote(dataDir)} ${args.map(quote).join(' ')}`
}
